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
  ShieldAlert,
  Search,
  UserCheck,
  Check,
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
  const [filter, setFilter] = useState<"upcoming" | "all" | "completed">("upcoming");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const handleToggle = async (item: ScheduleItem) => {
    setUpdatingId(item.id);
    try {
      await onToggleStatus(item);
      if (selectedItem && selectedItem.id === item.id) {
        // Toggle selected item status in modal view
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

    return true;
  });

  const todayCount = items.filter((item) => item.date >= todayStart.getTime() && item.date < todayStart.getTime() + 86400000).length;

  return (
    <div className="flex-1 flex flex-col pb-12 max-w-lg mx-auto w-full">
      {/* Top Header */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-4 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold shadow-md flex-shrink-0"
            style={{ backgroundColor: team.color || "#10b981" }}
          >
            <Wrench className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-white truncate">{team.name}</h1>
            {team.leaderName && (
              <p className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
                <UserCheck className="w-3 h-3 text-slate-500" />
                {team.leaderName}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={onLogout}
          title="Wyloguj ekipę"
          className="p-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Wyloguj</span>
        </button>
      </header>

      {/* Main Content Area */}
      <div className="p-4 space-y-4">
        {/* Quick Stats & Welcome */}
        <div className="bg-slate-800/50 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 font-medium">Harmonogram ekipy</div>
            <div className="text-lg font-extrabold text-white mt-0.5">
              {todayCount > 0 ? `${todayCount} zadań na dzisiaj` : "Brak zadań na dziś"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-emerald-400 tabular-nums">{items.length}</div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Łącznie</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-800/80 rounded-2xl border border-slate-800">
          {(
            [
              { key: "upcoming", label: "Do zrealizowania" },
              { key: "all", label: "Wszystkie" },
              { key: "completed", label: "Wykonane" },
            ] as const
          ).map((tab) => {
            const active = filter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  active
                    ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/10"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Szukaj klienta, adresu, telefonu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800/60 border border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-500 outline-none focus:border-slate-700 font-medium"
          />
        </div>

        {/* Schedule List */}
        {filteredItems.length === 0 ? (
          <div className="bg-slate-800/30 border border-dashed border-slate-800 rounded-2xl p-10 text-center text-slate-500 space-y-2">
            <CalendarIcon className="w-10 h-10 mx-auto text-slate-700 mb-1" />
            <p className="font-semibold text-slate-400 text-sm">Brak zaplanowanych zadań</p>
            <p className="text-xs text-slate-600">Nie znaleziono pozycji w harmonogramie dla tej kategorii.</p>
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
                weekday: "short",
                day: "numeric",
                month: "short",
              });

              return (
                <div
                  key={item.id}
                  className={`bg-slate-800/80 border rounded-2xl p-4 shadow-sm space-y-3 transition-all ${
                    isDone
                      ? "border-slate-800 opacity-60 bg-slate-900/40"
                      : "border-slate-700/80 hover:border-slate-600"
                  }`}
                >
                  {/* Item Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0 ${
                          isMontaz ? "bg-blue-600" : "bg-amber-600"
                        }`}
                      >
                        {isMontaz ? <Wrench className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                              isMontaz ? "bg-blue-500/20 text-blue-300" : "bg-amber-500/20 text-amber-300"
                            }`}
                          >
                            {isMontaz ? "Montaż" : "Serwis"}
                          </span>

                          <span className="text-xs font-semibold text-slate-400 capitalize">
                            {dateFormatted}
                          </span>
                        </div>
                        <h3 className="font-bold text-white text-sm truncate mt-0.5">{item.title}</h3>
                      </div>
                    </div>

                    {item.timeStr && (
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-slate-900/80 px-2.5 py-1 rounded-xl border border-slate-700 flex-shrink-0">
                        <Clock className="w-3 h-3" />
                        {item.timeStr}
                      </span>
                    )}
                  </div>

                  {/* Client & Address Info */}
                  <div className="space-y-1.5 text-xs text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    <div className="font-bold text-white text-sm">{item.clientName}</div>

                    <div className="flex items-center gap-2 text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <span className="truncate">{item.address}</span>
                    </div>

                    {item.phone && (
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                        <Phone className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        <a
                          href={`tel:${item.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-emerald-400 hover:underline"
                        >
                          {item.phone}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Item Footer / Quick Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      onClick={() => setSelectedItem(item)}
                      className="flex-1 py-2.5 bg-slate-700/60 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      Szczegóły
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleToggle(item)}
                      disabled={isUpdating}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 ${
                        isDone
                          ? "bg-slate-800 text-slate-400 hover:bg-slate-700"
                          : "bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-extrabold"
                      }`}
                    >
                      {isUpdating ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          {isDone ? "Wykonano" : "Zrealizuj"}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <CrewJobDetailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onToggleStatus={handleToggle}
        updating={updatingId === selectedItem?.id}
      />
    </div>
  );
}
