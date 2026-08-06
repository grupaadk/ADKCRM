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
} from "lucide-react";
import { CrewJobDetailModal } from "./CrewJobDetailModal";
import TUIMobileCalendarWrapper from "./TUIMobileCalendarWrapper";
import { DateStrip } from "./DateStrip";

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
  onLogout: () => void;
  onToggleStatus: (item: ScheduleItem) => Promise<void>;
  onChangeDate?: (item: ScheduleItem, newDate: Date) => Promise<void>;
}

export function CrewCalendarView({
  team,
  items,
  onLogout,
  onToggleStatus,
  onChangeDate,
}: CrewCalendarViewProps) {
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [filter, setFilter] = useState<"upcoming" | "all" | "completed">("upcoming");
  const [typeFilter, setTypeFilter] = useState<"all" | "montaz" | "serwis">("all");
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);
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
    <div className="flex-1 flex flex-col pb-12 max-w-5xl mx-auto w-full">
      {/* Top Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 p-4 sticky top-0 z-30 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold shadow-sm flex-shrink-0"
            style={{ backgroundColor: team.color || "#10b981" }}
          >
            <Wrench className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-extrabold text-slate-900 truncate">{team.name}</h1>
            {team.leaderName && (
              <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate font-medium">
                <UserCheck className="w-3 h-3 text-slate-400" />
                Kierownik: {team.leaderName}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={onLogout}
          title="Wyloguj ekipę"
          className="p-2.5 rounded-xl bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer border border-slate-200"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Wyloguj</span>
        </button>
      </header>

      {/* Main View Mode Selector (Kalendarz vs Lista) */}
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs">
          <button
            onClick={() => setViewMode("calendar")}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              viewMode === "calendar"
                ? "bg-[var(--accent)] text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Kalendarz Ekipy
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              viewMode === "list"
                ? "bg-[var(--accent)] text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <List className="w-4 h-4" />
            Lista Prac ({items.length})
          </button>
        </div>

        {/* CALENDAR VIEW MODE */}
        {viewMode === "calendar" && (
          <div className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
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

        {/* LIST VIEW MODE FILTERS */}
        {viewMode === "list" && (
          <div className="space-y-4">
            <DateStrip
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              markedDates={items.map((item) => item.date)}
            />

            <div className="space-y-3 bg-white p-3.5 border border-slate-200 rounded-2xl shadow-xs">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Szukaj zlecenia, klienta, adresu..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:bg-white text-slate-900"
                />
              </div>

              <div className="flex items-center gap-1.5">
                {(["upcoming", "all", "completed"] as const).map((st) => {
                  const label = st === "upcoming" ? "Do zrobienia" : st === "all" ? "Wszystkie" : "Wykonane";
                  const active = filter === st;
                  return (
                    <button
                      key={st}
                      onClick={() => setFilter(st)}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer text-center ${
                        active
                          ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5">
                {(["all", "montaz", "serwis"] as const).map((t) => {
                  const label = t === "all" ? "Wszystkie typy" : t === "montaz" ? "🔧 Montaż" : "🛠️ Serwis";
                  const active = typeFilter === t;
                  const activeColor =
                    t === "montaz"
                      ? "bg-blue-600 text-white border-blue-600"
                      : t === "serwis"
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-[var(--accent)] text-white border-[var(--accent)]";
                  return (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer text-center ${
                        active ? activeColor : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Shared List of Tasks */}
            {filteredItems.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
                <CalendarIcon className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="font-bold text-slate-800 text-sm">Brak prac w tym widoku</p>
                <p className="text-xs text-slate-500 mt-1">Brak zrealizowanych lub zaplanowanych zadań.</p>
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

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={`bg-white border rounded-2xl p-4 shadow-xs hover:shadow-md transition-all space-y-3 cursor-pointer group select-none ${
                        isDone ? "border-emerald-200 bg-emerald-50/20 opacity-80" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {/* Badge bar */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                              isMontaz
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {isMontaz ? "🔧 Montaż" : "🛠️ Serwis"}
                          </span>

                          <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {dateFormatted} {item.timeStr ? `(${item.timeStr})` : ""}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggle(item);
                          }}
                          disabled={isUpdating}
                          className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                            isDone
                              ? "bg-emerald-500 text-white border-emerald-500"
                              : "bg-slate-100 text-slate-400 border-slate-200 hover:text-emerald-600 hover:bg-emerald-50"
                          }`}
                          title={isDone ? "Cofnij wykonanie" : "Oznacz jako wykonane"}
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                        </button>
                      </div>

                      {/* Main Job Info */}
                      <div>
                        <h3 className={`font-bold text-sm ${isDone ? "text-slate-500 line-through" : "text-slate-900"} group-hover:text-blue-600 transition-colors`}>
                          {item.title}
                        </h3>
                        <p className="text-xs font-semibold text-slate-700 mt-0.5">{item.clientName}</p>
                      </div>

                      {/* Address & Phone quick links */}
                      <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5 truncate">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate">{item.address}</span>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                          {item.phone && (
                            <a
                              href={`tel:${item.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md transition-colors"
                            >
                              <Phone className="w-3 h-3" />
                              {item.phone}
                            </a>
                          )}
                          <span className="text-slate-400 font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
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

      {selectedItem && (
        <CrewJobDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onToggleStatus={handleToggle}
          updating={updatingId === selectedItem?.id}
        />
      )}
    </div>
  );
}
