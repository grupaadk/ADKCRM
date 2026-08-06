"use client";

import { useState } from "react";
import {
  Wrench,
  LogOut,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Phone,
  ChevronRight,
  Search,
  UserCheck,
  Check,
  List,
  CalendarDays,
  Sparkles,
  Navigation,
} from "lucide-react";
import { CrewJobDetailModal } from "./CrewJobDetailModal";
import { CrewVehicleModal } from "./CrewVehicleModal";
import TUIMobileCalendarWrapper from "./TUIMobileCalendarWrapper";
import { DateStrip } from "./DateStrip";
import { Truck } from "lucide-react";

interface TeamData {
  _id: string;
  name: string;
  color: string;
  leaderName?: string;
  phone?: string;
  members?: string[];
}

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

interface CrewCalendarViewProps {
  team: TeamData;
  items: ScheduleItem[];
  pin: string | null;
  onLogout: () => void;
  onToggleStatus: (item: ScheduleItem) => Promise<void>;
  onChangeDate?: (item: ScheduleItem, newDate: Date) => Promise<void>;
}

export function CrewCalendarView({
  team,
  items,
  pin,
  onLogout,
  onToggleStatus,
  onChangeDate,
}: CrewCalendarViewProps) {
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [filter, setFilter] = useState<"upcoming" | "all" | "completed">("upcoming");
  const [typeFilter, setTypeFilter] = useState<"all" | "montaz" | "serwis">("all");
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleToggle = async (item: ScheduleItem) => {
    setUpdatingId(item.id);
    try {
      await onToggleStatus(item);
      if (selectedItem && selectedItem.id === item.id) {
        const isMontaz = item.type === "montaz";
        const isCurrentlyDone = isMontaz
          ? item.status === "completed"
          : item.status === "rozwiazana" || item.status === "zamknieta" || item.status === "zakonczona";

        setSelectedItem({
          ...item,
          status: isMontaz
            ? isCurrentlyDone ? "installation" : "completed"
            : isCurrentlyDone ? "w_toku" : "rozwiazana",
        });
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Błąd aktualizacji statusu.");
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredItems = items.filter((item) => {
    const isMontaz = item.type === "montaz";
    const isDone = isMontaz
      ? item.status === "completed"
      : item.status === "rozwiazana" || item.status === "zamknieta" || item.status === "zakonczona";

    if (filter === "upcoming" && isDone) return false;
    if (filter === "completed" && !isDone) return false;

    if (typeFilter !== "all" && item.type !== typeFilter) return false;

    if (selectedDate) {
      const itemDate = new Date(item.date);
      if (
        itemDate.getFullYear() !== selectedDate.getFullYear() ||
        itemDate.getMonth() !== selectedDate.getMonth() ||
        itemDate.getDate() !== selectedDate.getDate()
      ) {
        return false;
      }
    }

    if (search.trim()) {
      const term = search.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(term);
      const matchClient = item.clientName.toLowerCase().includes(term);
      const matchAddress = item.address.toLowerCase().includes(term);
      const matchPhone = (item.phone ?? "").includes(term);
      if (!matchTitle && !matchClient && !matchAddress && !matchPhone) return false;
    }

    return true;
  });

  return (
    <div className="flex-1 flex flex-col pb-24 max-w-5xl mx-auto w-full min-h-[100dvh]" style={{ background: "var(--background)" }}>
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between border-b shadow-xs backdrop-blur-md" style={{ background: "var(--panel)", borderColor: "var(--line)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-xs flex-shrink-0" style={{ background: "var(--accent)" }}>
            <Wrench className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-extrabold strong truncate tracking-tight">{team.name}</h1>
              <span className="pill acc text-[10px]">
                PWA
              </span>
            </div>
            {team.leaderName && (
              <p className="text-[11px] dim flex items-center gap-1 truncate font-medium">
                <UserCheck className="w-3 h-3 text-slate-400" />
                Kierownik: {team.leaderName}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowVehicleModal(true)}
            title="Pojazd ekipy"
            className="btn primary text-xs font-semibold cursor-pointer active:scale-95 shadow-xs flex items-center gap-1.5"
          >
            <Truck className="w-4 h-4" />
            <span>Pojazd</span>
          </button>

          <button
            onClick={onLogout}
            title="Wyloguj ekipę"
            className="btn text-xs font-semibold cursor-pointer active:scale-95 shadow-xs"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Wyloguj</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="p-3.5 sm:p-5 space-y-4">
        
        {/* Navigation View Switcher */}
        <div className="flex items-center justify-between gap-2 p-1 rounded-xl border shadow-xs" style={{ background: "var(--panel)", borderColor: "var(--line)" }}>
          <button
            onClick={() => setViewMode("list")}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              viewMode === "list" ? "btn primary shadow-xs" : "btn ghost"
            }`}
          >
            <List className="w-4 h-4" />
            Harmonogram Prac ({items.length})
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              viewMode === "calendar" ? "btn primary shadow-xs" : "btn ghost"
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Siatka Miesięczna
          </button>
        </div>

        {/* CALENDAR VIEW MODE */}
        {viewMode === "calendar" && (
          <div className="animate-in fade-in zoom-in-95 duration-200">
            <TUIMobileCalendarWrapper
              items={items}
              filter={filter}
              search={search}
              onEventClick={(item: ScheduleItem) => setSelectedItem(item)}
              onEventDateChange={async (item: ScheduleItem, newDate: Date) => {
                if (onChangeDate) {
                  await onChangeDate(item, newDate);
                }
              }}
              onToggleEventStatus={handleToggle}
            />
          </div>
        )}

        {/* LIST VIEW MODE */}
        {viewMode === "list" && (
          <div className="space-y-4">
            {/* Interactive Date Strip */}
            <DateStrip
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              markedDates={items.map((item) => item.date)}
            />

            {/* Filter and Search Panel */}
            <div className="space-y-3 p-3.5 border rounded-2xl shadow-xs" style={{ background: "var(--panel)", borderColor: "var(--line)" }}>
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Szukaj klienta, adresu, zamówienia..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 border rounded-xl outline-none"
                  style={{ background: "var(--panel-2)", borderColor: "var(--line-2)" }}
                />
              </div>

              {/* Multi-status 2x2 Grid Filters */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFilter("upcoming")}
                  className={`p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                    filter === "upcoming"
                      ? "bg-amber-50 text-amber-800 border-amber-300 ring-2 ring-amber-400/20 font-bold shadow-xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Clock className={`w-4 h-4 ${filter === "upcoming" ? "text-amber-600" : "text-slate-400"}`} />
                    <span className="text-xs">Do wykonania</span>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100/80 text-amber-800">
                    {items.filter(i => {
                      const isM = i.type === "montaz";
                      return isM ? i.status !== "completed" : !(i.status === "rozwiazana" || i.status === "zamknieta" || i.status === "zakonczona");
                    }).length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilter("completed")}
                  className={`p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                    filter === "completed"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-400/20 font-bold shadow-xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Check className={`w-4 h-4 ${filter === "completed" ? "text-emerald-600" : "text-slate-400"}`} />
                    <span className="text-xs">Wykonane</span>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100/80 text-emerald-800">
                    {items.filter(i => {
                      const isM = i.type === "montaz";
                      return isM ? i.status === "completed" : (i.status === "rozwiazana" || i.status === "zamknieta" || i.status === "zakonczona");
                    }).length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTypeFilter(typeFilter === "montaz" ? "all" : "montaz")}
                  className={`p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                    typeFilter === "montaz"
                      ? "bg-blue-50 text-blue-800 border-blue-300 ring-2 ring-blue-400/20 font-bold shadow-xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Wrench className={`w-4 h-4 ${typeFilter === "montaz" ? "text-blue-600" : "text-slate-400"}`} />
                    <span className="text-xs">Tylko Montaże</span>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100/80 text-blue-800">
                    {items.filter(i => i.type === "montaz").length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTypeFilter(typeFilter === "serwis" ? "all" : "serwis")}
                  className={`p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                    typeFilter === "serwis"
                      ? "bg-orange-50 text-orange-800 border-orange-300 ring-2 ring-orange-400/20 font-bold shadow-xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className={`w-4 h-4 ${typeFilter === "serwis" ? "text-orange-600" : "text-slate-400"}`} />
                    <span className="text-xs">Tylko Serwisy</span>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100/80 text-orange-800">
                    {items.filter(i => i.type === "serwis").length}
                  </span>
                </button>
              </div>
            </div>

            {/* Schedule Cards List */}
            {filteredItems.length === 0 ? (
              <div className="panel p-10 text-center text-slate-500">
                <CalendarIcon className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                <p className="font-bold text-slate-800 text-sm">Brak prac w tym widoku</p>
                <p className="text-xs text-slate-500 mt-1">Spróbuj zmienić filtry lub wybraną datę.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => {
                  const isMontaz = item.type === "montaz";
                  const isDone = isMontaz
                    ? item.status === "completed"
                    : item.status === "rozwiazana" || item.status === "zamknieta" || item.status === "zakonczona";
                  const isUpdating = updatingId === item.id;

                  const dateFormatted = new Date(item.date).toLocaleDateString("pl-PL", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  });

                  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address)}`;

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={`panel p-4 shadow-xs hover:shadow-md transition-all space-y-3 cursor-pointer group select-none ${
                        isDone ? "bg-slate-50/50 opacity-80" : "hover:border-slate-300"
                      }`}
                    >
                      {/* Top Badges & Status Toggle */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`pill font-bold ${
                              isMontaz
                                ? "bg-blue-100 text-blue-800 border-blue-300"
                                : "bg-orange-100 text-orange-800 border-orange-300"
                            }`}
                          >
                            {isMontaz ? "🔧 Montaż" : "🛠️ Serwis"}
                          </span>

                          <span className="text-xs font-semibold dim flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 mute" />
                            {dateFormatted} {item.timeStr ? `(${item.timeStr})` : ""}
                          </span>
                        </div>

                        {/* Fast Status Toggle Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggle(item);
                          }}
                          disabled={isUpdating}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            isDone
                              ? "bg-emerald-500 text-white border-emerald-500"
                              : "btn icon ghost"
                          }`}
                          title={isDone ? "Cofnij wykonanie" : "Oznacz jako wykonane"}
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                        </button>
                      </div>

                      {/* Main Job Title & Client */}
                      <div>
                        <h3
                          className={`font-bold text-base ${
                            isDone ? "text-slate-400 line-through" : "strong"
                          } group-hover:text-blue-600 transition-colors leading-snug`}
                        >
                          {item.title}
                        </h3>
                        <p className="text-xs font-semibold text-slate-700 mt-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-cyan-600" /> {item.clientName}
                        </p>
                      </div>

                      {/* Address & Quick Actions Footer */}
                      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5 truncate">
                          <MapPin className="w-4 h-4 mute flex-shrink-0" />
                          <span className="truncate font-medium">{item.address}</span>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                          {/* Navigation Button */}
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="btn btn-xs"
                          >
                            <Navigation className="w-3 h-3 text-blue-600" />
                            Mapa
                          </a>

                          {/* Phone Call Button */}
                          {item.phone && (
                            <a
                              href={`tel:${item.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="btn btn-xs"
                            >
                              <Phone className="w-3 h-3 text-emerald-600" />
                              Zadzwoń
                            </a>
                          )}
                          
                          <span className="dim font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform text-[11px] ml-1">
                            Szczegóły <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Job Bottom Sheet Modal */}
      {selectedItem && (
        <CrewJobDetailModal
          item={selectedItem}
          pin={pin}
          onClose={() => setSelectedItem(null)}
          onToggleStatus={handleToggle}
          updating={updatingId === selectedItem?.id}
        />
      )}

      {/* Team Vehicle FMS Modal */}
      {showVehicleModal && (
        <CrewVehicleModal
          pin={pin}
          onClose={() => setShowVehicleModal(false)}
        />
      )}
    </div>
  );
}
