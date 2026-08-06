"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CrewPinLogin } from "@/components/ekipa/CrewPinLogin";
import { CrewCalendarView } from "@/components/ekipa/CrewCalendarView";

const STORAGE_KEY = "adk_crew_pin";

export default function EkipaPage() {
  const [pin, setPin] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Read saved PIN from localStorage & register Service Worker for WebAPK PWA
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && /^\d{4}$/.test(saved)) {
      setPin(saved);
    }
    setInitialized(true);

    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failed silently
      });
    }
  }, []);

  const scheduleData = useQuery(
    api.installationTeams.getScheduleByPin,
    pin ? { pin } : "skip"
  );

  const updateOrderStatus = useMutation(api.installationTeams.updateOrderStatusByPin);
  const updateComplaintStatus = useMutation(api.installationTeams.updateComplaintStatusByPin);
  const updateEventDate = useMutation(api.installationTeams.updateEventDateByPin);

  // Watch for invalid PIN response and reset accordingly
  useEffect(() => {
    if (!pin || scheduleData === undefined) return;
    if (scheduleData === null) {
      localStorage.removeItem(STORAGE_KEY);
      setPinError("Nieprawidłowy PIN ekipy lub ekipa jest nieaktywna.");
      setPin(null);
    } else {
      localStorage.setItem(STORAGE_KEY, pin);
    }
  }, [pin, scheduleData]);

  const handlePinSubmit = useCallback((enteredPin: string) => {
    setPinError(null);
    setPin(enteredPin);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setPin(null);
    setPinError(null);
  }, []);

  const handleToggleStatus = useCallback(
    async (item: { id: string; type: "montaz" | "serwis"; status: string }) => {
      if (!pin) return;

      if (item.type === "montaz") {
        const isDone = item.status === "completed";
        await updateOrderStatus({
          pin,
          orderId: item.id as Id<"orders">,
          newStatus: isDone ? "installation" : "completed",
        });
      } else {
        const isDone =
          item.status === "rozwiazana" ||
          item.status === "zamknieta" ||
          item.status === "zakonczona";
        await updateComplaintStatus({
          pin,
          complaintId: item.id as Id<"complaints">,
          newStatus: isDone ? "w_toku" : "rozwiazana",
        });
      }
    },
    [pin, updateOrderStatus, updateComplaintStatus]
  );

  const handleChangeDate = useCallback(
    async (item: { id: string; type: "montaz" | "serwis" }, newDate: Date) => {
      if (!pin) return;
      
      const newDateMs = newDate.getTime();
      await updateEventDate({
        pin,
        eventId: item.id as Id<"orders"> | Id<"complaints">,
        eventType: item.type,
        newDate: newDateMs,
      });
    },
    [pin, updateEventDate]
  );

  // Not yet hydrated — show spinner to prevent SSR mismatch
  if (!initialized) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-slate-400 text-xs">
        Ładowanie...
      </div>
    );
  }

  // PIN provided but schedule query still loading
  if (pin && scheduleData === undefined) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3 text-slate-400">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        <div className="text-xs font-medium">Weryfikowanie PIN-u i ładowanie kalendarza...</div>
      </div>
    );
  }

  // No valid PIN (or invalid) — show login screen
  if (!pin || !scheduleData) {
    return (
      <CrewPinLogin
        onSuccess={handlePinSubmit}
        errorMsg={pinError}
        loading={false}
      />
    );
  }

  // PIN valid, schedule loaded — show crew calendar
  return (
    <CrewCalendarView
      team={scheduleData.team}
      items={scheduleData.items}
      onLogout={handleLogout}
      onToggleStatus={handleToggleStatus}
      onChangeDate={handleChangeDate}
    />
  );
}
