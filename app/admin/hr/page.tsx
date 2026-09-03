"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  Check,
  X,
  CalendarDays,
  Building2,
  Wrench,
  Car,
  Users,
  Palmtree,
  Sparkles,
  Trash2,
} from "lucide-react";
import { EkipyView } from "@/app/admin/ekipy/page";
import { FlotaView } from "@/app/admin/flota/page";

// Tłumaczenie typów urlopu
const LEAVE_TYPES: Record<string, { label: string; bg: string; text: string }> = {
  vacation: { label: "Urlop wypoczynkowy", bg: "bg-blue-50", text: "text-blue-700" },
  sick: { label: "L4 / Chorobowe", bg: "bg-rose-50", text: "text-rose-700" },
  unpaid: { label: "Urlop bezpłatny", bg: "bg-gray-100", text: "text-gray-700" },
  other: { label: "Inny urlop / Zwolnienie", bg: "bg-purple-50", text: "text-purple-700" },
};

// Badges statusów
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "approved":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
          <CheckCircle2 className="size-3.5" />
          Zatwierdzony
        </span>
      );
    case "rejected":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
          <XCircle className="size-3.5" />
          Odrzucony
        </span>
      );
    case "cancelled":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/20">
          Anulowany
        </span>
      );
    case "pending":
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
          <AlertCircle className="size-3.5" />
          Oczekujący
        </span>
      );
  }
}

export default function HrPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") as "hr" | "ekipy" | "flota" | null;
  const [mainModuleTab, setMainModuleTab] = useState<"hr" | "ekipy" | "flota">(
    initialTab && ["hr", "ekipy", "flota"].includes(initialTab) ? initialTab : "hr"
  );

  const me = useQuery(api.users.me);
  const myHrData = useQuery(api.hr.getMyHrData);
  const summary = useQuery(api.hr.getHrSummary);

  const isAdmin = me?.role === "admin";

  // Podsekcja HR: Admin domyślnie "admin" (Zarządzanie), Pracownik "my" (Osobiste)
  const [activeTab, setActiveTab] = useState<"my" | "admin">("my");
  const [subTab, setSubTab] = useState<"leaves" | "overtime" | "employees">("leaves");

  const requestsTableRef = useRef<HTMLDivElement>(null);

  // Po pobraniu danych użytkownika przełącz na widok admina jeśli użytkownik jest adminem
  useEffect(() => {
    if (isAdmin) {
      setActiveTab("admin");
    }
  }, [isAdmin]);

  // Stan filtrowania dla Admina
  const [adminUserFilter, setAdminUserFilter] = useState<string>("");
  const [adminStatusFilter, setAdminStatusFilter] = useState<string>("all");
  const [adminMonthFilter, setAdminMonthFilter] = useState<string>("");

  // Zapytania admina
  const allHrData = useQuery(
    api.hr.getAllHrData,
    isAdmin && mainModuleTab === "hr"
      ? {
          userId: adminUserFilter ? (adminUserFilter as Id<"users">) : undefined,
          status: adminStatusFilter !== "all" ? adminStatusFilter : undefined,
          month: adminMonthFilter || undefined,
        }
      : "skip"
  );

  const employeesOverview = useQuery(
    api.hr.getEmployeesHrOverview,
    isAdmin && mainModuleTab === "hr" ? {} : "skip"
  );

  const assignableUsers = useQuery(api.users.listAllActive);

  // Modale
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isOvertimeModalOpen, setIsOvertimeModalOpen] = useState(false);

  // Formularz urlopowy
  const [leaveForm, setLeaveForm] = useState({
    type: "vacation" as "vacation" | "sick" | "unpaid" | "other",
    startDate: "",
    endDate: "",
    daysCount: 1,
    reason: "",
  });

  // Formularz nadgodzin
  const [overtimeForm, setOvertimeForm] = useState({
    date: new Date().toISOString().split("T")[0],
    hours: 2,
    description: "",
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mutations
  const submitLeaveMut = useMutation(api.hr.submitLeave);
  const submitOvertimeMut = useMutation(api.hr.submitOvertime);
  const updateLeaveStatusMut = useMutation(api.hr.updateLeaveStatus);
  const updateOvertimeStatusMut = useMutation(api.hr.updateOvertimeStatus);
  const cancelLeaveMut = useMutation(api.hr.cancelLeave);
  const deleteOvertimeMut = useMutation(api.hr.deleteOvertime);
  const deleteLeaveMut = useMutation(api.hr.deleteLeave);

  // Stan inline-potwierdzenia usuwania (zbiór ID)
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<Set<string>>(new Set());
  const toggleConfirm = (id: string) =>
    setConfirmDeleteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // Obliczanie dni roboczych przy zmianie dat
  const handleLeaveDateChange = (start: string, end: string) => {
    setLeaveForm((prev) => ({ ...prev, startDate: start, endDate: end }));
    if (start && end && start <= end) {
      const s = new Date(start);
      const e = new Date(end);
      let count = 0;
      const cur = new Date(s);
      while (cur <= e) {
        const day = cur.getDay();
        if (day !== 0 && day !== 6) {
          count++;
        }
        cur.setDate(cur.getDate() + 1);
      }
      setLeaveForm((prev) => ({ ...prev, daysCount: Math.max(1, count) }));
    }
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      await submitLeaveMut({
        type: leaveForm.type,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        daysCount: leaveForm.daysCount,
        reason: leaveForm.reason || undefined,
      });
      setIsLeaveModalOpen(false);
      setLeaveForm({
        type: "vacation",
        startDate: "",
        endDate: "",
        daysCount: 1,
        reason: "",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Błąd podczas dodawania wniosku urlopowego.";
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOvertimeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      await submitOvertimeMut({
        date: overtimeForm.date,
        hours: overtimeForm.hours,
        description: overtimeForm.description,
      });
      setIsOvertimeModalOpen(false);
      setOvertimeForm({
        date: new Date().toISOString().split("T")[0],
        hours: 2,
        description: "",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Błąd podczas zgłaszania nadgodzin.";
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Nagłówek główny dostosowany pod rolę */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              {isAdmin ? "Panel Zarządzania HR i Zasobami" : "Mój Portal Pracownika — HR"}
            </h1>
            {isAdmin && (
              <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                Widok Administratora
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {isAdmin
              ? "Centrum kontroli pracowników, wniosków urlopowych, nadgodzin, ekip montażowych oraz floty."
              : `Witaj, ${me?.displayName || me?.login || "Pracowniku"}! System zarządzania HR i zasobami.`}
          </p>
        </div>
      </div>

      {/* Główne zakładki modułu HR (Urlopy/Nadgodziny | Ekipy Montażowe | Flota) */}
      <div className="mt-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setMainModuleTab("hr")}
            className={`flex items-center gap-2.5 border-b-2 py-3 px-1 text-sm font-semibold transition ${
              mainModuleTab === "hr"
                ? "border-brand text-brand"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            <Clock className="size-4.5" />
            Urlopy i Nadgodziny
          </button>

          <button
            onClick={() => setMainModuleTab("ekipy")}
            className={`flex items-center gap-2.5 border-b-2 py-3 px-1 text-sm font-semibold transition ${
              mainModuleTab === "ekipy"
                ? "border-brand text-brand"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            <Wrench className="size-4.5" />
            Ekipy Montażowe
          </button>

          <button
            onClick={() => setMainModuleTab("flota")}
            className={`flex items-center gap-2.5 border-b-2 py-3 px-1 text-sm font-semibold transition ${
              mainModuleTab === "flota"
                ? "border-brand text-brand"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            <Car className="size-4.5" />
            Flota Pojazdów
          </button>
        </nav>
      </div>

      {/* WIDOK: EKIPY MONTAŻOWE */}
      {mainModuleTab === "ekipy" && (
        <div className="mt-6">
          <EkipyView />
        </div>
      )}

      {/* WIDOK: FLOTA POJAZDÓW */}
      {mainModuleTab === "flota" && (
        <div className="mt-6">
          <FlotaView />
        </div>
      )}

      {/* WIDOK: URLOPY I NADGODZINY */}
      {mainModuleTab === "hr" && (
        <>
          {/* Pasek akcji składania wniosków w zakładce Urlopy i Nadgodziny */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-gray-50 p-4 border border-gray-200">
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Urlopy i Nadgodziny
              </h2>
              <p className="text-xs text-gray-500">
                Złóż wniosek urlopowy lub zarejestruj wypracowane nadgodziny.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setFormError(null);
                  setIsLeaveModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
              >
                <Calendar className="size-4" />
                Wniosek o urlop
              </button>
              <button
                onClick={() => {
                  setFormError(null);
                  setIsOvertimeModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
              >
                <Clock className="size-4" />
                Wpisz nadgodziny
              </button>
            </div>
          </div>

          {/* Opcje pod-przełącznika dla Admina (Zarządzanie Pracownikami vs Moje Osobiste) */}
          {isAdmin && (
            <div className="mt-4 flex items-center justify-between rounded-xl bg-purple-50 p-3 border border-purple-100">
              <div className="flex items-center gap-2 text-sm font-semibold text-purple-900">
                <Building2 className="size-5 text-purple-600" />
                Tryb wyświetlania:
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab("admin")}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                    activeTab === "admin"
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-white text-purple-700 hover:bg-purple-100"
                  }`}
                >
                  <Users className="inline size-3.5 mr-1.5" />
                  Zarządzanie Pracownikami ({assignableUsers?.length ?? 0})
                </button>
                <button
                  onClick={() => setActiveTab("my")}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                    activeTab === "my"
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-white text-purple-700 hover:bg-purple-100"
                  }`}
                >
                  <User className="inline size-3.5 mr-1.5" />
                  Moje Osobiste HR
                </button>
              </div>
            </div>
          )}

          {/* WIDOK DLA ADMINISTRATORA (ZARZĄDZANIE PRACOWNIKAMI) */}
          {isAdmin && activeTab === "admin" && (
            <div className="mt-6 space-y-8">
              {/* Baner Podsumowania Zespołu */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="overflow-hidden rounded-xl border border-purple-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-purple-700">
                      Wszyscy Pracownicy
                    </span>
                    <div className="flex size-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                      <Users className="size-5" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">
                      {employeesOverview?.length ?? 0}
                    </span>
                    <span className="text-sm font-medium text-gray-500">osób</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">Aktywne konta w systemie</p>
                </div>

                <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                      Oczekujące Urlopy
                    </span>
                    <div className="flex size-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                      <Palmtree className="size-5" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-amber-900">
                      {summary?.companySummary?.pendingLeavesCount ?? 0}
                    </span>
                    <span className="text-sm font-medium text-amber-700">wniosków</span>
                  </div>
                  <p className="mt-2 text-xs text-amber-700 font-medium">Czekają na akceptację</p>
                </div>

                <div className="overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                      Oczekujące Nadgodziny
                    </span>
                    <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                      <Clock className="size-5" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-emerald-900">
                      {summary?.companySummary?.pendingOvertimeCount ?? 0}
                    </span>
                    <span className="text-sm font-medium text-emerald-700">zgłoszeń</span>
                  </div>
                  <p className="mt-2 text-xs text-emerald-700 font-medium">Do zatwierdzenia</p>
                </div>

                <div className="overflow-hidden rounded-xl border border-blue-200 bg-blue-50/40 p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                      Na urlopie dzisiaj
                    </span>
                    <div className="flex size-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                      <CalendarDays className="size-5" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-blue-900">
                      {employeesOverview?.filter((e) => e.onLeaveToday).length ?? 0}
                    </span>
                    <span className="text-sm font-medium text-blue-700">pracowników</span>
                  </div>
                  <p className="mt-2 text-xs text-blue-600 font-medium">Aktualnie nieobecni</p>
                </div>
              </div>

              {/* Tabela Przeglądu Pracowników dla Admina */}
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Users className="size-5 text-brand" />
                    Zbiorczy Stan Pracowników
                  </h3>
                  <span className="text-xs text-gray-500">
                    Kliknij pracownika, aby przefiltrować wnioski
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-6 py-3.5 font-semibold">Pracownik</th>
                        <th className="px-6 py-3.5 font-semibold">Urlop (wykorzystany)</th>
                        <th className="px-6 py-3.5 font-semibold">Nadgodziny (zatwierdzone)</th>
                        <th className="px-6 py-3.5 font-semibold">Oczekujące decyzje</th>
                        <th className="px-6 py-3.5 text-right font-semibold">Filtruj</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {employeesOverview?.map((emp) => (
                        <tr key={emp._id} className="hover:bg-purple-50/30 transition">
                          <td className="whitespace-nowrap px-6 py-4 font-bold text-gray-900 flex items-center gap-3">
                            <span
                              className="size-3 rounded-full shrink-0"
                              style={{ backgroundColor: emp.color || "#6b7280" }}
                            />
                            <div>
                              <div>{emp.displayName}</div>
                              <div className="text-xs font-normal text-gray-400">{emp.email}</div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 font-semibold text-gray-900">
                            {emp.approvedVacationDays} dn.
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 font-bold text-emerald-600">
                            +{emp.approvedOvertimeHours}h
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            {emp.pendingLeavesCount + emp.pendingOvertimeCount > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 animate-pulse">
                                {emp.pendingLeavesCount + emp.pendingOvertimeCount} do akceptacji
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Brak</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-right">
                            <button
                              onClick={() => {
                                setAdminUserFilter(emp._id);
                                setSubTab("leaves");
                                setTimeout(() => {
                                  requestsTableRef.current?.scrollIntoView({ behavior: "smooth" });
                                }, 50);
                              }}
                              className="text-xs font-semibold text-brand hover:underline"
                            >
                              Pokaż wnioski →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sekcja Zarządzania Wnioskami (Urlopy i Nadgodziny) */}
              <div ref={requestsTableRef} className="space-y-4 scroll-mt-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSubTab("leaves")}
                      className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                        subTab === "leaves"
                          ? "bg-brand text-white shadow-sm"
                          : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
                      }`}
                    >
                      Wnioski Urlopowe Zespołu ({allHrData?.leaves.length ?? 0})
                    </button>
                    <button
                      onClick={() => setSubTab("overtime")}
                      className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                        subTab === "overtime"
                          ? "bg-brand text-white shadow-sm"
                          : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
                      }`}
                    >
                      Godziny Dodatkowe Zespołu ({allHrData?.overtime.length ?? 0})
                    </button>
                  </div>

                  {/* Pasek Filtrów */}
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={adminUserFilter}
                      onChange={(e) => setAdminUserFilter(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 focus:border-brand focus:outline-none"
                    >
                      <option value="">Wszyscy pracownicy</option>
                      {assignableUsers?.filter((u) => u.showInPickers !== false).map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.displayName || u.login}
                        </option>
                      ))}
                    </select>

                    <select
                      value={adminStatusFilter}
                      onChange={(e) => setAdminStatusFilter(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 focus:border-brand focus:outline-none"
                    >
                      <option value="all">Wszystkie statusy</option>
                      <option value="pending">Oczekujące</option>
                      <option value="approved">Zatwierdzone</option>
                      <option value="rejected">Odrzucone</option>
                    </select>

                    <input
                      type="month"
                      value={adminMonthFilter}
                      onChange={(e) => setAdminMonthFilter(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 focus:border-brand focus:outline-none"
                      title="Filtruj wg miesiąca"
                    />

                    {(adminUserFilter || adminStatusFilter !== "all" || adminMonthFilter) && (
                      <button
                        onClick={() => {
                          setAdminUserFilter("");
                          setAdminStatusFilter("all");
                          setAdminMonthFilter("");
                        }}
                        className="text-xs font-semibold text-red-600 hover:underline"
                      >
                        Resetuj
                      </button>
                    )}
                  </div>
                </div>

                {/* Tabela zgłoszeń urlopowych w widoku Admina */}
                {subTab === "leaves" ? (
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                    {allHrData?.leaves && allHrData.leaves.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-600">
                          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                            <tr>
                              <th className="px-6 py-3.5 font-semibold">Pracownik</th>
                              <th className="px-6 py-3.5 font-semibold">Typ urlopu</th>
                              <th className="px-6 py-3.5 font-semibold">Okres</th>
                              <th className="px-6 py-3.5 font-semibold">Dni</th>
                              <th className="px-6 py-3.5 font-semibold">Status</th>
                              <th className="px-6 py-3.5 font-semibold">Powód</th>
                              <th className="px-6 py-3.5 text-right font-semibold">Decyzja Admina</th>
                              <th className="px-6 py-3.5 w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {allHrData.leaves.map((leave) => {
                              const typeInfo = LEAVE_TYPES[leave.type] || LEAVE_TYPES.other;
                              return (
                                <tr key={leave._id} className="hover:bg-gray-50/50">
                                  <td className="whitespace-nowrap px-6 py-4 font-semibold text-gray-900">
                                    {leave.userName}
                                  </td>
                                  <td className="whitespace-nowrap px-6 py-4">
                                    <span
                                      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${typeInfo.bg} ${typeInfo.text}`}
                                    >
                                      {typeInfo.label}
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
                                    {leave.startDate} do {leave.endDate}
                                  </td>
                                  <td className="whitespace-nowrap px-6 py-4 font-semibold text-gray-900">
                                    {leave.daysCount} dn.
                                  </td>
                                  <td className="whitespace-nowrap px-6 py-4">
                                    <StatusBadge status={leave.status} />
                                  </td>
                                  <td className="max-w-xs truncate px-6 py-4 text-gray-500">
                                    {leave.reason || "—"}
                                  </td>
                                  <td className="whitespace-nowrap px-6 py-4 text-right">
                                    {leave.status === "pending" ? (
                                      <div className="flex items-center justify-end gap-2">
                                        <button
                                          onClick={async () => {
                                            await updateLeaveStatusMut({
                                              leaveId: leave._id,
                                              status: "approved",
                                            });
                                          }}
                                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm"
                                        >
                                          <Check className="size-3.5" />
                                          Zatwierdź
                                        </button>
                                        <button
                                          onClick={async () => {
                                            await updateLeaveStatusMut({
                                              leaveId: leave._id,
                                              status: "rejected",
                                            });
                                          }}
                                          className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                                        >
                                          <X className="size-3.5" />
                                          Odrzuć
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-400">Przetworzono</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-4 text-right">
                                    {confirmDeleteIds.has(leave._id) ? (
                                      <div className="flex items-center justify-end gap-1">
                                        <span className="text-xs text-red-600 font-semibold whitespace-nowrap">Na pewno?</span>
                                        <button
                                          onClick={async () => {
                                            await deleteLeaveMut({ leaveId: leave._id });
                                            toggleConfirm(leave._id);
                                          }}
                                          className="inline-flex items-center gap-0.5 rounded bg-red-600 px-2 py-1 text-xs font-bold text-white hover:bg-red-700"
                                        >
                                          Usuń
                                        </button>
                                        <button
                                          onClick={() => toggleConfirm(leave._id)}
                                          className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100"
                                        >
                                          Anuluj
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => toggleConfirm(leave._id)}
                                        className="rounded p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition"
                                        title="Usuń wniosek"
                                      >
                                        <Trash2 className="size-3.5" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-8 text-center text-gray-500">
                        Brak wniosków urlopowych spełniających kryteria.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                    {allHrData?.overtime && allHrData.overtime.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-600">
                          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                            <tr>
                              <th className="px-6 py-3.5 font-semibold">Pracownik</th>
                              <th className="px-6 py-3.5 font-semibold">Data</th>
                              <th className="px-6 py-3.5 font-semibold">Liczba godzin</th>
                              <th className="px-6 py-3.5 font-semibold">Status</th>
                              <th className="px-6 py-3.5 font-semibold">Opis prac</th>
                              <th className="px-6 py-3.5 text-right font-semibold">Decyzja Admina</th>
                              <th className="px-6 py-3.5 w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {allHrData.overtime.map((ot) => (
                              <tr key={ot._id} className="hover:bg-gray-50/50">
                                <td className="whitespace-nowrap px-6 py-4 font-semibold text-gray-900">
                                  {ot.userName}
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
                                  {ot.date}
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 font-bold text-emerald-600">
                                  +{ot.hours}h
                                </td>
                                <td className="whitespace-nowrap px-6 py-4">
                                  <StatusBadge status={ot.status} />
                                </td>
                                <td className="max-w-md truncate px-6 py-4 text-gray-600">
                                  {ot.description}
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 text-right">
                                  {ot.status === "pending" ? (
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={async () => {
                                          await updateOvertimeStatusMut({
                                            overtimeId: ot._id,
                                            status: "approved",
                                          });
                                        }}
                                        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm"
                                      >
                                        <Check className="size-3.5" />
                                        Zatwierdź
                                      </button>
                                      <button
                                        onClick={async () => {
                                          await updateOvertimeStatusMut({
                                            overtimeId: ot._id,
                                            status: "rejected",
                                          });
                                        }}
                                        className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                                      >
                                        <X className="size-3.5" />
                                        Odrzuć
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-gray-400">Przetworzono</span>
                                  )}
                                </td>
                                <td className="px-3 py-4 text-right">
                                  {confirmDeleteIds.has(ot._id) ? (
                                    <div className="flex items-center justify-end gap-1">
                                      <span className="text-xs text-red-600 font-semibold whitespace-nowrap">Na pewno?</span>
                                      <button
                                        onClick={async () => {
                                          await deleteOvertimeMut({ overtimeId: ot._id });
                                          toggleConfirm(ot._id);
                                        }}
                                        className="inline-flex items-center gap-0.5 rounded bg-red-600 px-2 py-1 text-xs font-bold text-white hover:bg-red-700"
                                      >
                                        Usuń
                                      </button>
                                      <button
                                        onClick={() => toggleConfirm(ot._id)}
                                        className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100"
                                      >
                                        Anuluj
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => toggleConfirm(ot._id)}
                                      className="rounded p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition"
                                      title="Usuń godziny dodatkowe"
                                    >
                                      <Trash2 className="size-3.5" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-8 text-center text-gray-500">
                        Brak nadgodzin spełniających kryteria.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* WIDOK DLA PRACOWNIKA (LUB PRZEŁĄCZONE OSOBISTE DLA ADMINA) */}
          {(!isAdmin || activeTab === "my") && (
            <div className="mt-6 space-y-6">
              {/* Baner Powitalny Pracownika */}
              <div className="rounded-2xl bg-gradient-to-r from-brand/90 to-brand p-6 text-white shadow-md">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Sparkles className="size-5 text-amber-300" />
                      Twoje Centrum HR
                    </h2>
                    <p className="mt-1 text-sm text-blue-100">
                      Przeglądaj swój wykorzystany urlop, godziny nadgodzin i status złożonych wniosków.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setFormError(null);
                        setIsLeaveModalOpen(true);
                      }}
                      className="rounded-lg bg-white/20 px-4 py-2 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/30"
                    >
                      + Wniosek urlopowy
                    </button>
                    <button
                      onClick={() => {
                        setFormError(null);
                        setIsOvertimeModalOpen(true);
                      }}
                      className="rounded-lg bg-emerald-500/80 px-4 py-2 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-emerald-500"
                    >
                      + Wpisz nadgodziny
                    </button>
                  </div>
                </div>
              </div>

              {/* Karty Osobistych Statystyk Pracownika */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Mój urlop (rok)
                    </span>
                    <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-brand">
                      <CalendarDays className="size-5" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">
                      {summary?.mySummary.approvedVacationDays ?? 0}
                    </span>
                    <span className="text-sm font-medium text-gray-500">dni</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">Zaakceptowane urlopy</p>
                </div>

                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Moje Nadgodziny
                    </span>
                    <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <Clock className="size-5" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">
                      {summary?.mySummary.approvedOvertimeHours ?? 0}
                    </span>
                    <span className="text-sm font-medium text-gray-500">godz.</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">Zatwierdzone czasowo</p>
                </div>

                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      W trakcie rozpatrywania
                    </span>
                    <div className="flex size-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                      <AlertCircle className="size-5" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">
                      {(summary?.mySummary.pendingLeavesCount ?? 0) +
                        (summary?.mySummary.pendingOvertimeHours ? 1 : 0)}
                    </span>
                    <span className="text-sm font-medium text-gray-500">wnioski</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">Czekające na odpowiedź</p>
                </div>
              </div>

              {/* Tabela historii osobistej pracownika */}
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSubTab("leaves")}
                      className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                        subTab === "leaves"
                          ? "bg-brand text-white shadow-sm"
                          : "bg-gray-100 text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      Moje Urlopy
                    </button>
                    <button
                      onClick={() => setSubTab("overtime")}
                      className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                        subTab === "overtime"
                          ? "bg-brand text-white shadow-sm"
                          : "bg-gray-100 text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      Moje Nadgodziny
                    </button>
                  </div>
                </div>

                {subTab === "leaves" ? (
                  myHrData?.leaves && myHrData.leaves.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                          <tr>
                            <th className="px-6 py-3.5 font-semibold">Typ urlopu</th>
                            <th className="px-6 py-3.5 font-semibold">Okres</th>
                            <th className="px-6 py-3.5 font-semibold">Dni</th>
                            <th className="px-6 py-3.5 font-semibold">Status</th>
                            <th className="px-6 py-3.5 font-semibold">Powód / Uwagi</th>
                            <th className="px-6 py-3.5 text-right font-semibold">Akcja</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {myHrData.leaves.map((leave) => {
                            const typeInfo = LEAVE_TYPES[leave.type] || LEAVE_TYPES.other;
                            return (
                              <tr key={leave._id} className="hover:bg-gray-50/50">
                                <td className="whitespace-nowrap px-6 py-4">
                                  <span
                                    className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${typeInfo.bg} ${typeInfo.text}`}
                                  >
                                    {typeInfo.label}
                                  </span>
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
                                  {leave.startDate} do {leave.endDate}
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 font-semibold text-gray-900">
                                  {leave.daysCount} dn.
                                </td>
                                <td className="whitespace-nowrap px-6 py-4">
                                  <StatusBadge status={leave.status} />
                                </td>
                                <td className="max-w-xs truncate px-6 py-4 text-gray-500">
                                  {leave.reason || "—"}
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 text-right">
                                  {leave.status === "pending" && (
                                    <button
                                      onClick={async () => {
                                        if (confirm("Czy na pewno chcesz anulować ten wniosek?")) {
                                          await cancelLeaveMut({ leaveId: leave._id });
                                        }
                                      }}
                                      className="text-xs font-medium text-red-600 hover:text-red-800"
                                    >
                                      Anuluj
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-500">
                      Brak zgłoszonych wniosków urlopowych.
                    </div>
                  )
                ) : (
                  myHrData?.overtime && myHrData.overtime.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                          <tr>
                            <th className="px-6 py-3.5 font-semibold">Data</th>
                            <th className="px-6 py-3.5 font-semibold">Liczba godzin</th>
                            <th className="px-6 py-3.5 font-semibold">Status</th>
                            <th className="px-6 py-3.5 font-semibold">Opis prac</th>
                            <th className="px-6 py-3.5 text-right font-semibold">Akcja</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {myHrData.overtime.map((ot) => (
                            <tr key={ot._id} className="hover:bg-gray-50/50">
                              <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
                                {ot.date}
                              </td>
                              <td className="whitespace-nowrap px-6 py-4 font-bold text-emerald-600">
                                +{ot.hours}h
                              </td>
                              <td className="whitespace-nowrap px-6 py-4">
                                <StatusBadge status={ot.status} />
                              </td>
                              <td className="max-w-md truncate px-6 py-4 text-gray-600">
                                {ot.description}
                              </td>
                              <td className="whitespace-nowrap px-6 py-4 text-right">
                                {ot.status === "pending" && (
                                  <button
                                    onClick={async () => {
                                      if (confirm("Czy na pewno chcesz usunąć ten wpis?")) {
                                        await deleteOvertimeMut({ overtimeId: ot._id });
                                      }
                                    }}
                                    className="text-xs font-medium text-red-600 hover:text-red-800"
                                  >
                                    Usuń
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-500">
                      Brak zgłoszonych nadgodzin.
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: WNIOSEK O URLOP */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h2 className="text-lg font-bold text-gray-900">
                Złóż wniosek urlopowy
              </h2>
              <button
                onClick={() => setIsLeaveModalOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="size-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleLeaveSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Typ urlopu
                </label>
                <select
                  value={leaveForm.type}
                  onChange={(e) =>
                    setLeaveForm({ ...leaveForm, type: e.target.value as "vacation" | "sick" | "unpaid" | "other" })
                  }
                  className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <option value="vacation">Urlop wypoczynkowy</option>
                  <option value="sick">L4 / Chorobowe</option>
                  <option value="unpaid">Urlop bezpłatny</option>
                  <option value="other">Inne zwolnienie</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Data rozpoczęcia
                  </label>
                  <input
                    type="date"
                    required
                    value={leaveForm.startDate}
                    onChange={(e) =>
                      handleLeaveDateChange(e.target.value, leaveForm.endDate)
                    }
                    className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Data zakończenia
                  </label>
                  <input
                    type="date"
                    required
                    value={leaveForm.endDate}
                    onChange={(e) =>
                      handleLeaveDateChange(leaveForm.startDate, e.target.value)
                    }
                    className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Wyliczona liczba dni roboczych
                </label>
                <input
                  type="number"
                  min="1"
                  value={leaveForm.daysCount}
                  onChange={(e) =>
                    setLeaveForm({ ...leaveForm, daysCount: parseInt(e.target.value) || 1 })
                  }
                  className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Powód / Uzasadnienie (opcjonalnie)
                </label>
                <textarea
                  rows={3}
                  value={leaveForm.reason}
                  onChange={(e) =>
                    setLeaveForm({ ...leaveForm, reason: e.target.value })
                  }
                  placeholder="Wpisz krótki komentarz..."
                  className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50"
                >
                  {isSubmitting ? "Wysyłanie..." : "Wyślij wniosek"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: WPISZ NADGODZINY */}
      {isOvertimeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h2 className="text-lg font-bold text-gray-900">
                Zgłoś godziny dodatkowe (nadgodziny)
              </h2>
              <button
                onClick={() => setIsOvertimeModalOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="size-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleOvertimeSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Data wykonania
                  </label>
                  <input
                    type="date"
                    required
                    value={overtimeForm.date}
                    onChange={(e) =>
                      setOvertimeForm({ ...overtimeForm, date: e.target.value })
                    }
                    className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Liczba godzin (np. 2 lub 3.5)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    value={overtimeForm.hours}
                    onChange={(e) =>
                      setOvertimeForm({
                        ...overtimeForm,
                        hours: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Opis wykonanych prac / zlecenia
                </label>
                <textarea
                  rows={3}
                  required
                  value={overtimeForm.description}
                  onChange={(e) =>
                    setOvertimeForm({ ...overtimeForm, description: e.target.value })
                  }
                  placeholder="Opisz jakie zadania lub zlecenia zostały wykonane..."
                  className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOvertimeModalOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Zgłaszanie..." : "Zapisz nadgodziny"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
