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

function MobileCalendar({
  items,
  selectedDate,
  onSelectDate,
}: {
  items: ScheduleItem[];
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  const days = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));

  const monthNames = [
    "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
  ];

  return (
    <div className="w-full bg-white border border-slate-200 rounded-2xl p-4 shadow-sm select-none">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
          className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4 text-slate-600 rotate-180" />
        </button>
        <h3 className="font-bold text-slate-900 text-sm">
          {monthNames[month]} {year}
        </h3>
        <button
          onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
          className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">
        {["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((date, i) => {
          if (!date) return <div key={i} className="h-10" />;

          const isSelected = date.getTime() === selectedDate.getTime();
          const isToday =
            date.getTime() === new Date(new Date().setHours(0, 0, 0, 0)).getTime();

          const dayItems = items.filter((item) => {
            const d = new Date(item.date);
            d.setHours(0, 0, 0, 0);
            return d.getTime() === date.getTime();
          });

          return (
            <button
              key={i}
              onClick={() => onSelectDate(date)}
              className={`h-10 rounded-xl flex flex-col items-center justify-center relative border transition-colors cursor-pointer ${
                isSelected
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : isToday
                  ? "bg-slate-50 text-slate-900 border-slate-200"
                  : "bg-white border-transparent text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="font-bold text-xs">{date.getDate()}</span>
              {dayItems.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {dayItems.slice(0, 3).map((it, idx) => (
                    <div
                      key={idx}
                      className={`w-1 h-1 rounded-full ${
                        isSelected ? "bg-white" : "bg-emerald-500"
                      }`}
                    />
                  ))}
                  {dayItems.length > 3 && (
                    <div
                      className={`w-1 h-1 rounded-full ${
                        isSelected ? "bg-white" : "bg-emerald-500"
                      }`}
                    />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface CrewCalendarViewProps {
  team: TeamData;
  items: ScheduleItem[];
  onLogout: () => void;
  onToggleStatus: (item: ScheduleItem) => Promise<void>;
}

export function CrewCalendarView({
  team,
  items,
  onLogout,
  onToggleStatus,
}: CrewCalendarViewProps) {
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [filter, setFilter] = useState<"upcoming" | "all" | "completed">("upcoming");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [selectedDate, setSelectedDate] = useState<Date>(todayStart);

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

    if (search.trim()) {
      const term = search.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(term);
      const matchClient = item.clientName.toLowerCase().includes(term);
      const matchAddress = item.address.toLowerCase().includes(term);
      const matchPhone = (item.phone ?? "").includes(term);
      if (!matchTitle && !matchClient && !matchAddress && !matchPhone) return false;
    }

    if (viewMode === "calendar") {
      const d = new Date(item.date);
      d.setHours(0, 0, 0, 0);
      if (d.getTime() !== selectedDate.getTime()) return false;
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
                ? "bg-slate-900 text-white shadow-sm"
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
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <List className="w-4 h-4" />
            Lista Prac ({items.length})
          </button>
        </div>

        {/* CALENDAR VIEW MODE */}
        {viewMode === "calendar" && (
          <div className="space-y-4">
            <MobileCalendar
              items={items}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />

            <div className="flex items-center justify-between pb-2 border-b border-slate-200 mt-6">
              <h3 className="font-bold text-slate-900 text-sm">
                Zadania na {selectedDate.toLocaleDateString("pl-PL", { day: "numeric", month: "long" })}
              </h3>
            </div>
          </div>
        )}

        {/* LIST VIEW MODE FILTERS */}
        {viewMode === "list" && (
          <div className="space-y-4">
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
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"
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
                      className={`bg-white border rounded-2xl p-4 shadow-xs hover:shadow-md transition-all space-y-3 cursor-pointer group ${
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

      {/* Item Detail Modal */}
      <CrewJobDetailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onToggleStatus={handleToggle}
        updating={updatingId === selectedItem?.id}
      />
    </div>
  );
}
