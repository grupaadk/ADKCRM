"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Clock,
  Wrench,
  Car,
  ChevronLeft,
  ChevronRight,
  Settings2,
  X,
  Calendar as CalendarIcon,
  Palmtree,
} from "lucide-react";
import { EkipyView } from "@/app/admin/ekipy/page";
import { FlotaView } from "@/app/admin/flota/page";

type ActiveCell = {
  table: "leaves" | "overtime";
  userId: Id<"users">;
  rowIndex: number;
};

function formatHoursPl(val: number): string {
  const rounded = Math.round(val * 100) / 100;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${String(rounded).replace(".", ",")} h`;
}

export default function HrPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") as "hr" | "ekipy" | "flota" | null;
  const [mainModuleTab, setMainModuleTab] = useState<"hr" | "ekipy" | "flota">(
    initialTab && ["hr", "ekipy", "flota"].includes(initialTab) ? initialTab : "hr"
  );

  const me = useQuery(api.users.me);
  const isAdmin = me?.role === "admin";

  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const sheetData = useQuery(
    api.hr.getSpreadsheetData,
    mainModuleTab === "hr" ? { year: selectedYear } : "skip"
  );

  const setLeaveCellMut = useMutation(api.hr.setLeaveCell);
  const setOvertimeCellMut = useMutation(api.hr.setOvertimeCell);
  const updateConfigMut = useMutation(api.hr.updateEmployeeSheetConfig);

  // Stan aktywnej (edytowanej) komórki w arkuszu
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [cellError, setCellError] = useState<string | null>(null);
  const [isSavingCell, setIsSavingCell] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const datePickerRef = useRef<HTMLInputElement | null>(null);

  // Modal konfiguracji limitów i widoczności kolumn
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);

  // Dzisiejsza data w formacie YYYY-MM-DD do kolorowania urlopów (przyszłe = niebieskie, przeszłe = ciemne)
  const todayStr = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (activeCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [activeCell]);

  const employees = sheetData?.employees ?? [];
  const leaveEmployees = employees.filter((e) => e.showInLeaves);
  const overtimeEmployees = employees.filter((e) => e.showInOvertime);

  // Wysokość tabeli URLOPY: maksymalny limit urlopu wśród widocznych pracowników (minimum 26 wierszy)
  const maxLeaveAllowance = Math.max(
    26,
    ...leaveEmployees.map((e) => e.vacationAllowance),
    ...leaveEmployees.flatMap((e) =>
      Object.keys(e.leaveCells).map((k) => Number(k) + 1)
    )
  );

  // Wysokość tabeli GODZINY: min. 14 wierszy (lub więcej jeśli są wpisy)
  const maxOvertimeRow = Math.max(
    14,
    ...overtimeEmployees.flatMap((e) =>
      Object.keys(e.overtimeCells).map((k) => Number(k) + 2)
    )
  );

  const startEditingLeave = (userId: Id<"users">, rowIndex: number, currentVal: string) => {
    setCellError(null);
    setActiveCell({ table: "leaves", userId, rowIndex });
    setEditValue(currentVal);
  };

  const startEditingOvertime = (userId: Id<"users">, rowIndex: number, currentVal: string) => {
    setCellError(null);
    setActiveCell({ table: "overtime", userId, rowIndex });
    setEditValue(currentVal);
  };

  const commitActiveCell = async (moveNextRow?: number): Promise<boolean> => {
    if (!activeCell || isSavingCell) return true;
    const current = activeCell;
    const emp = employees.find((e) => e._id === current.userId);
    if (!emp) {
      setActiveCell(null);
      return true;
    }

    if (current.table === "leaves") {
      const existing = emp.leaveCells[current.rowIndex];
      const prevVal = existing?.displayDate ?? "";
      const nextVal = editValue.trim();

      if (nextVal === prevVal) {
        if (typeof moveNextRow === "number" && moveNextRow >= 0 && moveNextRow < emp.vacationAllowance) {
          const nextExisting = emp.leaveCells[moveNextRow]?.displayDate ?? "";
          startEditingLeave(current.userId, moveNextRow, nextExisting);
        } else {
          setActiveCell(null);
        }
        return true;
      }

      setIsSavingCell(true);
      setCellError(null);
      try {
        await setLeaveCellMut({
          userId: current.userId,
          year: selectedYear,
          rowIndex: current.rowIndex,
          value: nextVal,
          existingId: existing?._id,
        });
        if (typeof moveNextRow === "number" && moveNextRow >= 0 && moveNextRow < emp.vacationAllowance) {
          const nextExisting = emp.leaveCells[moveNextRow]?.displayDate ?? "";
          startEditingLeave(current.userId, moveNextRow, nextExisting);
        } else {
          setActiveCell(null);
        }
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Błąd zapisu daty.";
        setCellError(msg);
        return false;
      } finally {
        setIsSavingCell(false);
      }
    } else {
      const existing = emp.overtimeCells[current.rowIndex];
      const prevVal = existing?.rawText ?? "";
      const nextVal = editValue.trim();

      if (nextVal === prevVal) {
        if (typeof moveNextRow === "number" && moveNextRow >= 0 && moveNextRow < maxOvertimeRow) {
          const nextExisting = emp.overtimeCells[moveNextRow]?.rawText ?? "";
          startEditingOvertime(current.userId, moveNextRow, nextExisting);
        } else {
          setActiveCell(null);
        }
        return true;
      }

      setIsSavingCell(true);
      setCellError(null);
      try {
        await setOvertimeCellMut({
          userId: current.userId,
          year: selectedYear,
          rowIndex: current.rowIndex,
          rawText: nextVal,
          existingId: existing?._id,
        });
        if (typeof moveNextRow === "number" && moveNextRow >= 0 && moveNextRow < maxOvertimeRow) {
          const nextExisting = emp.overtimeCells[moveNextRow]?.rawText ?? "";
          startEditingOvertime(current.userId, moveNextRow, nextExisting);
        } else {
          setActiveCell(null);
        }
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Błąd zapisu godzin.";
        setCellError(msg);
        return false;
      } finally {
        setIsSavingCell(false);
      }
    }
  };

  return (
    <div className="w-full">
      {/* Nagłówek główny strony (spójny z całym modułem HR / Ekipy / Flota) */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              Panel Zarządzania HR i Zasobami
            </h1>
            {isAdmin && (
              <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                Widok Administratora
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Ewidencja urlopów i godzin, zarządzanie ekipami montażowymi oraz flotą pojazdów.
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

      {/* WIDOK: URLOPY I NADGODZINY (STYL CRM) */}
      {mainModuleTab === "hr" && (
        <div className="mt-6 space-y-6">
          {/* Pasek narzędziowy sekcji (identyczny styl jak w Ekipach i Flocie) */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
                <Palmtree className="size-5 text-brand" />
                Ewidencja Urlopów i Godzin ({selectedYear})
              </h2>
              <p className="text-xs text-gray-500">
                Kliknij dowolną kratkę w tabeli, aby wpisać datę urlopu (DD.MM) lub rozliczenie godzin.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Legenda kolorów w stylu CRM */}
              <div className="hidden sm:flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs shadow-2xs">
                <span className="flex items-center gap-1.5 text-gray-700 font-medium">
                  <span className="size-2 rounded-full bg-gray-800" />
                  Wykorzystany
                </span>
                <span className="h-3 w-px bg-gray-200" />
                <span className="flex items-center gap-1.5 text-blue-600 font-semibold">
                  <span className="size-2 rounded-full bg-blue-600" />
                  Zaplanowany
                </span>
              </div>

              {/* Przełącznik roku */}
              <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => {
                    setActiveCell(null);
                    setSelectedYear((y) => y - 1);
                  }}
                  className="rounded-md p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
                  title="Poprzedni rok"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span className="px-3 text-xs font-bold text-gray-900 tabular-nums select-none">
                  {selectedYear}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveCell(null);
                    setSelectedYear((y) => y + 1);
                  }}
                  className="rounded-md p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
                  title="Następny rok"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>

              {/* Przycisk ustawień limitów i kolumn */}
              <button
                type="button"
                onClick={() => setIsConfigOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand/90"
              >
                <Settings2 className="size-4" />
                Limity i kolumny
              </button>
            </div>
          </div>

          {cellError && (
            <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700 shadow-2xs">
              <span>{cellError}</span>
              <button
                type="button"
                onClick={() => setCellError(null)}
                className="rounded-md p-1 text-red-500 hover:bg-red-100 hover:text-red-700"
              >
                <X className="size-4" />
              </button>
            </div>
          )}

          {!sheetData ? (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500 shadow-sm">
              Ładowanie ewidencji urlopów i godzin...
            </div>
          ) : employees.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500 shadow-sm">
              Brak aktywnych użytkowników w systemie.
            </div>
          ) : (
            <div className="w-full pb-4">
              <div className="flex flex-col xl:flex-row items-start gap-6 w-full">
                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* KARTA 1: URLOPY {ROK}                                           */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                {leaveEmployees.length > 0 && (
                  <div className="w-full xl:flex-1 min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                    {/* Nagłówek karty CRM */}
                    <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50/90 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex size-7 items-center justify-center rounded-lg bg-brand/10 text-brand">
                          <CalendarIcon className="size-4" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-800">
                          Urlopy {selectedYear}
                        </span>
                      </div>
                      <span className="rounded-full bg-gray-200/70 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600">
                        {leaveEmployees.length} os.
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full table-fixed border-collapse text-sm select-none">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50/40">
                            <th className="w-10 border-r border-gray-200 px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                              #
                            </th>
                            {leaveEmployees.map((emp) => (
                              <th
                                key={emp._id}
                                title={`${emp.displayName} — wykorzystano: ${emp.usedLeaveDays} z ${emp.vacationAllowance} dni (pozostało: ${emp.remainingLeaveDays})`}
                                className="min-w-[110px] border-r border-gray-200 last:border-r-0 px-2.5 py-2.5 text-center"
                              >
                                <div className="flex items-center justify-center gap-1.5">
                                  <span
                                    className="size-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: emp.color || "#4ABBC3" }}
                                  />
                                  <span className="truncate text-xs font-bold text-gray-900">
                                    {emp.shortName}
                                  </span>
                                </div>
                                <div className="mt-0.5 text-[10px] font-medium text-gray-400 tabular-nums">
                                  {emp.usedLeaveDays} / {emp.vacationAllowance} dn.
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {Array.from({ length: maxLeaveAllowance }).map((_, rowIndex) => {
                            const isStripedRow = rowIndex % 2 === 1;
                            return (
                              <tr
                                key={rowIndex}
                                className={`h-[30px] ${
                                  isStripedRow ? "bg-gray-50/50" : "bg-white"
                                }`}
                              >
                                {/* Numer wiersza */}
                                <td className="w-10 border-r border-gray-200 bg-gray-50/70 px-1.5 text-center text-[10px] font-medium text-gray-400 tabular-nums">
                                  {rowIndex + 1}
                                </td>

                                {leaveEmployees.map((emp) => {
                                  const isDisabled = rowIndex >= emp.vacationAllowance;
                                  const cellData = emp.leaveCells[rowIndex];
                                  const isEditing =
                                    activeCell?.table === "leaves" &&
                                    activeCell.userId === emp._id &&
                                    activeCell.rowIndex === rowIndex;

                                  if (isDisabled) {
                                    return (
                                      <td
                                        key={emp._id}
                                        className="h-[30px] border-r border-gray-200 last:border-r-0 bg-slate-200/75"
                                        style={{
                                          backgroundImage:
                                            "repeating-linear-gradient(135deg, transparent, transparent 5px, rgba(148,163,184,0.18) 5px, rgba(148,163,184,0.18) 10px)",
                                        }}
                                        title={`Limit urlopu dla ${emp.shortName}: ${emp.vacationAllowance} dni`}
                                      />
                                    );
                                  }

                                  // Przyszła data -> niebieska, przeszła lub dzisiejsza -> ciemna
                                  const isFutureDate =
                                    cellData ? cellData.dateStr > todayStr : false;

                                  return (
                                    <td
                                      key={emp._id}
                                      onClick={() => {
                                        if (!isEditing) {
                                          startEditingLeave(
                                            emp._id,
                                            rowIndex,
                                            cellData?.displayDate ?? ""
                                          );
                                        }
                                      }}
                                      className={`relative h-[30px] border-r border-gray-200 last:border-r-0 px-1.5 text-center align-middle cursor-text transition-colors ${
                                        isEditing
                                          ? "bg-brand/5 ring-2 ring-inset ring-brand"
                                          : "hover:bg-brand/5"
                                      }`}
                                    >
                                      {isEditing ? (
                                        <div className="flex items-center justify-center w-full h-full">
                                          <input
                                            ref={inputRef}
                                            type="text"
                                            value={editValue}
                                            placeholder="DD.MM"
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={() => {
                                              void commitActiveCell();
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter" || e.key === "ArrowDown") {
                                                e.preventDefault();
                                                void commitActiveCell(rowIndex + 1);
                                              } else if (e.key === "ArrowUp") {
                                                e.preventDefault();
                                                void commitActiveCell(rowIndex - 1);
                                              } else if (e.key === "Escape") {
                                                e.preventDefault();
                                                setCellError(null);
                                                setActiveCell(null);
                                              }
                                            }}
                                            className="w-full bg-transparent text-center text-xs font-semibold text-gray-900 tabular-nums focus:outline-none"
                                          />
                                          <button
                                            type="button"
                                            tabIndex={-1}
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              datePickerRef.current?.showPicker?.();
                                            }}
                                            className="text-gray-400 hover:text-brand pr-0.5 transition"
                                            title="Wybierz z kalendarza"
                                          >
                                            <CalendarIcon className="size-3.5" />
                                          </button>
                                          <input
                                            ref={datePickerRef}
                                            type="date"
                                            tabIndex={-1}
                                            min={`${selectedYear}-01-01`}
                                            max={`${selectedYear}-12-31`}
                                            value={
                                              cellData?.dateStr ||
                                              `${selectedYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`
                                            }
                                            onChange={async (e) => {
                                              const picked = e.target.value;
                                              if (!picked) return;
                                              const parts = picked.split("-");
                                              if (parts.length === 3) {
                                                const ddMm = `${parts[2]}.${parts[1]}`;
                                                setEditValue(ddMm);
                                                await setLeaveCellMut({
                                                  userId: emp._id,
                                                  year: selectedYear,
                                                  rowIndex,
                                                  value: ddMm,
                                                  existingId: cellData?._id,
                                                });
                                                setActiveCell(null);
                                              }
                                            }}
                                            className="sr-only"
                                          />
                                        </div>
                                      ) : cellData ? (
                                        <span
                                          className={`inline-block text-xs tabular-nums ${
                                            isFutureDate
                                              ? "font-semibold text-blue-600"
                                              : "font-medium text-gray-800"
                                          }`}
                                        >
                                          {cellData.displayDate}
                                        </span>
                                      ) : null}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-gray-200 bg-gray-50 text-[11px]">
                            <td className="w-10 border-r border-gray-200 px-1.5 py-2 text-center font-semibold text-gray-400">
                              Σ
                            </td>
                            {leaveEmployees.map((emp) => (
                              <td
                                key={emp._id}
                                className="border-r border-gray-200 last:border-r-0 px-2 py-2 text-center"
                              >
                                <div className="font-bold text-gray-900 tabular-nums">
                                  {emp.usedLeaveDays} / {emp.vacationAllowance} dn.
                                </div>
                                <div
                                  className={`text-[10px] font-medium tabular-nums ${
                                    emp.remainingLeaveDays < 0
                                      ? "text-red-600 font-bold"
                                      : "text-gray-500"
                                  }`}
                                >
                                  zostało: {emp.remainingLeaveDays} dn.
                                </div>
                              </td>
                            ))}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* KARTA 2: GODZINY                                                */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                {overtimeEmployees.length > 0 && (
                  <div className="w-full xl:flex-1 min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                    {/* Nagłówek karty CRM */}
                    <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50/90 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                          <Clock className="size-4" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-800">
                          Godziny
                        </span>
                      </div>
                      <span className="rounded-full bg-gray-200/70 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600">
                        {overtimeEmployees.length} os.
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full table-fixed border-collapse text-sm select-none">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50/40">
                            <th className="w-10 border-r border-gray-200 px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                              #
                            </th>
                            {overtimeEmployees.map((emp) => (
                              <th
                                key={emp._id}
                                className="min-w-[120px] border-r border-gray-200 last:border-r-0 px-2.5 py-2.5 text-center"
                              >
                                <div className="flex items-center justify-center gap-1.5">
                                  <span
                                    className="size-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: emp.color || "#10b981" }}
                                  />
                                  <span className="truncate text-xs font-bold text-gray-900">
                                    {emp.shortName}
                                  </span>
                                </div>
                                <div className="mt-0.5 text-[10px] font-medium text-gray-400 tabular-nums">
                                  bilans: {formatHoursPl(emp.totalOvertimeHours)}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {Array.from({ length: maxOvertimeRow }).map((_, rowIndex) => {
                            const isStripedRow = rowIndex % 2 === 1;
                            return (
                              <tr
                                key={rowIndex}
                                className={`h-[30px] ${
                                  isStripedRow ? "bg-gray-50/50" : "bg-white"
                                }`}
                              >
                                {/* Numer wiersza */}
                                <td className="w-10 border-r border-gray-200 bg-gray-50/70 px-1.5 text-center text-[10px] font-medium text-gray-400 tabular-nums">
                                  {rowIndex + 1}
                                </td>

                                {overtimeEmployees.map((emp) => {
                                  const cellData = emp.overtimeCells[rowIndex];
                                  const isEditing =
                                    activeCell?.table === "overtime" &&
                                    activeCell.userId === emp._id &&
                                    activeCell.rowIndex === rowIndex;

                                  return (
                                    <td
                                      key={emp._id}
                                      onClick={() => {
                                        if (!isEditing) {
                                          startEditingOvertime(
                                            emp._id,
                                            rowIndex,
                                            cellData?.rawText ?? ""
                                          );
                                        }
                                      }}
                                      className={`h-[30px] border-r border-gray-200 last:border-r-0 px-2 text-center align-middle cursor-text transition-colors ${
                                        isEditing
                                          ? "bg-brand/5 ring-2 ring-inset ring-brand"
                                          : "hover:bg-brand/5"
                                      }`}
                                    >
                                      {isEditing ? (
                                        <input
                                          ref={inputRef}
                                          type="text"
                                          value={editValue}
                                          placeholder="- 2,5 h (17.08)"
                                          onChange={(e) => setEditValue(e.target.value)}
                                          onBlur={() => {
                                            void commitActiveCell();
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === "ArrowDown") {
                                              e.preventDefault();
                                              void commitActiveCell(rowIndex + 1);
                                            } else if (e.key === "ArrowUp") {
                                              e.preventDefault();
                                              void commitActiveCell(rowIndex - 1);
                                            } else if (e.key === "Escape") {
                                              e.preventDefault();
                                              setCellError(null);
                                              setActiveCell(null);
                                            }
                                          }}
                                          className="w-full bg-transparent text-center text-xs font-semibold text-gray-900 tabular-nums focus:outline-none"
                                        />
                                      ) : cellData ? (
                                        <span className="text-xs font-medium text-gray-800 tabular-nums">
                                          {cellData.rawText}
                                        </span>
                                      ) : null}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-gray-200 bg-gray-50 text-[11px]">
                            <td className="w-10 border-r border-gray-200 px-1.5 py-2 text-center font-semibold text-gray-400">
                              Σ
                            </td>
                            {overtimeEmployees.map((emp) => (
                              <td
                                key={emp._id}
                                className="border-r border-gray-200 last:border-r-0 px-2 py-2 text-center"
                              >
                                <span
                                  className={`font-bold tabular-nums ${
                                    emp.totalOvertimeHours > 0
                                      ? "text-emerald-600"
                                      : emp.totalOvertimeHours < 0
                                      ? "text-amber-700"
                                      : "text-gray-600"
                                  }`}
                                >
                                  {formatHoursPl(emp.totalOvertimeHours)}
                                </span>
                              </td>
                            ))}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL KONFIGURACJI LIMITÓW I WIDOCZNOŚCI KOLUMN UŻYTKOWNIKÓW */}
      {isConfigOpen && sheetData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Limity urlopowe i widoczność kolumn ({selectedYear})
                </h2>
                <p className="text-xs text-gray-500">
                  Ustaw roczny limit dni urlopu (liczbę aktywnych kratek) oraz wybierz, w których tabelach wyświetlają się poszczególni użytkownicy systemu.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 max-h-[65vh] overflow-y-auto rounded-xl border border-gray-200">
              <table className="w-full text-left text-sm text-gray-700">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Użytkownik</th>
                    <th className="px-4 py-3 text-center font-semibold">
                      Limit dni urlopu
                    </th>
                    <th className="px-4 py-3 text-center font-semibold">
                      Tabela URLOPY
                    </th>
                    <th className="px-4 py-3 text-center font-semibold">
                      Tabela GODZINY
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {employees.map((emp) => (
                    <tr key={emp._id} className="hover:bg-gray-50/80 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="size-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: emp.color || "#4ABBC3" }}
                          />
                          <div>
                            <div className="font-semibold text-gray-900">
                              {emp.shortName}{" "}
                              <span className="text-xs font-normal text-gray-500">
                                ({emp.displayName})
                              </span>
                            </div>
                            <div className="text-xs text-gray-400">{emp.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min={0}
                          max={365}
                          defaultValue={emp.vacationAllowance}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!Number.isNaN(val) && val !== emp.vacationAllowance) {
                              void updateConfigMut({
                                userId: emp._id,
                                year: selectedYear,
                                daysCount: Math.max(0, Math.min(365, val)),
                              });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="w-20 rounded-lg border border-gray-300 px-2.5 py-1 text-center text-sm font-semibold text-gray-900 tabular-nums focus:border-brand focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={emp.showInLeaves}
                          onChange={(e) => {
                            void updateConfigMut({
                              userId: emp._id,
                              year: selectedYear,
                              showInLeaves: e.target.checked,
                            });
                          }}
                          className="size-4 rounded border-gray-300 text-brand focus:ring-brand"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={emp.showInOvertime}
                          onChange={(e) => {
                            void updateConfigMut({
                              userId: emp._id,
                              year: selectedYear,
                              showInOvertime: e.target.checked,
                            });
                          }}
                          className="size-4 rounded border-gray-300 text-brand focus:ring-brand"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90"
              >
                Gotowe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
