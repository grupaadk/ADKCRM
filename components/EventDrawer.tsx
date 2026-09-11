"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  X,
  MapPin,
  Phone,
  ExternalLink,
  Calendar,
  Clock,
  Users,
  Camera,
  Trash2,
  Check,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import imageCompression from "browser-image-compression";
import { useStatuses } from "@/components/StatusLabelsContext";

export interface ScheduleEventItem {
  id: string;
  type: "montaz" | "serwis" | "wlasne" | string;
  title: string;
  customText?: string;
  services?: string[];
  description?: string;
  date: number;
  startDate?: number;
  endDate?: number;
  timeStr?: string;
  status: string;
  clientName: string;
  phone?: string;
  email?: string;
  address?: string;
  comment?: string;
  clientId?: Id<"clients">;
  orderId?: Id<"orders">;
  userColor?: string;
}

interface EventDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  item: ScheduleEventItem | null;
  onSaveSuccess?: () => void;
}

export default function EventDrawer({
  isOpen,
  onClose,
  item,
  onSaveSuccess,
}: EventDrawerProps) {
  const statuses = useStatuses();

  // Queries
  const teams = useQuery(api.installationTeams.listActive);

  // Mutations
  const updateOrder = useMutation(api.orders.update);
  const changeOrderStatus = useMutation(api.orders.changeStatus);
  const updateCalendarEvent = useMutation(api.calendarEvents.updateEvent);
  const deleteCalendarEvent = useMutation(api.calendarEvents.deleteEvent);

  // State
  const [status, setStatus] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");
  const [timeStr, setTimeStr] = useState<string>("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  const [, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Populate state when item changes
  useEffect(() => {
    if (item) {
      setStatus(item.status || "measurement");
      setComment(item.comment || item.description || "");
      setSelectedTeamId("");
      setPhotos([]);
      setPhotoPreviews([]);

      // Format date
      const d = item.date ? new Date(item.date) : new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      setDateStr(`${yyyy}-${mm}-${dd}`);

      // Format time
      if (item.timeStr && item.timeStr.includes(":")) {
        setTimeStr(item.timeStr);
      } else {
        const hh = String(d.getHours()).padStart(2, "0");
        const min = String(d.getMinutes()).padStart(2, "0");
        setTimeStr(`${hh}:${min}`);
      }
    }
  }, [item]);

  if (!isOpen || !item) return null;

  // Extract real orderId if item.id has format orderId_inst_X
  const realOrderId = item.orderId
    ? item.orderId
    : item.id.includes("_inst_")
    ? (item.id.split("_inst_")[0] as Id<"orders">)
    : item.type === "montaz" || item.type === "serwis"
    ? (item.id as Id<"orders">)
    : null;

  const isCustomEvent = item.type === "wlasne" || !realOrderId;

  // Quick photo selection with compression
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      const compressedFiles: File[] = [];
      const previews: string[] = [];

      for (const file of files) {
        const options = {
          maxSizeMB: 0.8,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
        };
        const compressed = await imageCompression(file, options);
        compressedFiles.push(compressed);
        previews.push(URL.createObjectURL(compressed));
      }

      setPhotos((prev) => [...prev, ...compressedFiles]);
      setPhotoPreviews((prev) => [...prev, ...previews]);
      toast.success(`Dodano ${files.length} zdjęcie(a)`);
    } catch (error) {
      console.error("Błąd kompresji zdjęcia:", error);
      toast.error("Nie udało się skompresować zdjęcia");
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // Save changes handler
  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (isCustomEvent) {
        // Update custom calendar event
        const calendarEventId = item.id as Id<"calendarEvents">;
        const [year, month, day] = dateStr.split("-").map(Number);
        const [hours, minutes] = timeStr.split(":").map(Number);
        const eventDate = new Date(year, month - 1, day, hours || 0, minutes || 0).getTime();

        await updateCalendarEvent({
          id: calendarEventId,
          title: item.title,
          description: comment,
          startDate: eventDate,
        });

        toast.success("Wydarzenie zostało zaktualizowane");
      } else if (realOrderId) {
        // Update Order status if changed
        if (status && status !== item.status) {
          try {
            await changeOrderStatus({
              orderId: realOrderId,
              newStatus: status,
            });
          } catch (err: unknown) {
            console.warn("Status change info:", (err as Error)?.message);
          }
        }

        // Prepare order patch
        const patchArgs: Parameters<typeof updateOrder>[0] = {
          orderId: realOrderId,
          comment: comment,
        };

        if (selectedTeamId) {
          patchArgs.installationTeamId = selectedTeamId as Id<"installationTeams">;
        }

        if (dateStr) {
          const [year, month, day] = dateStr.split("-").map(Number);
          const [hours, minutes] = timeStr ? timeStr.split(":").map(Number) : [8, 0];
          const newDateTs = new Date(year, month - 1, day, hours || 0, minutes || 0).getTime();
          patchArgs.projectStartDate = newDateTs;

          if (timeStr) {
            patchArgs.installationStartDate = (hours || 0) * 60 + (minutes || 0);
          }
        }

        await updateOrder(patchArgs);
        toast.success("Zlecenie zaktualizowane pomyślnie");
      }

      onSaveSuccess?.();
      onClose();
    } catch (error: unknown) {
      console.error("Błąd zapisu wydarzenia:", error);
      toast.error((error as Error)?.message || "Błąd podczas zapisywania zmian");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete / Cancel event handler
  const handleDeleteOrCancel = async () => {
    if (!confirm("Czy na pewno chcesz anulować / usunąć to wydarzenie?")) return;

    setIsDeleting(true);
    try {
      if (isCustomEvent) {
        await deleteCalendarEvent({ id: item.id as Id<"calendarEvents"> });
        toast.success("Wydarzenie zostało usunięte z kalendarza");
      } else if (realOrderId) {
        await changeOrderStatus({
          orderId: realOrderId,
          newStatus: "cancelled",
        });
        toast.success("Zlecenie zostało anulowane");
      }

      onSaveSuccess?.();
      onClose();
    } catch (error: unknown) {
      console.error("Błąd podczas odwoływania:", error);
      toast.error((error as Error)?.message || "Nie udało się anulować wydarzenia");
    } finally {
      setIsDeleting(false);
    }
  };

  // Map links
  const mapUrl = item.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address)}`
    : null;

  // Phone link
  const phoneUrl = item.phone ? `tel:${item.phone.replace(/\s+/g, "")}` : null;

  // Order link
  const orderHref = realOrderId ? `/app/zlecenie/${realOrderId}?from=home` : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Background click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Card */}
      <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl z-10 overflow-hidden">
        {/* Top Drag Handle */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2.5 shrink-0" />

        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                  item.type === "montaz"
                    ? "bg-emerald-100 text-emerald-800"
                    : item.type === "serwis"
                    ? "bg-purple-100 text-purple-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {item.type === "montaz"
                  ? "Montaż"
                  : item.type === "serwis"
                  ? "Serwis"
                  : "Wydarzenie własne"}
              </span>

              {item.status && (
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  {statuses.find((s) => s.key === item.status)?.label || item.status}
                </span>
              )}
            </div>

            {item.clientName && item.clientName !== "Wydarzenie własne" && (
              <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                {item.clientName}
              </h2>
            )}
            <p className="text-xs font-semibold text-slate-600">{item.title}</p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Quick Action Bar (Maps, Phone, Order Link) */}
          <div className="grid grid-cols-3 gap-2">
            {mapUrl ? (
              <a
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 active:scale-95 transition text-center"
              >
                <MapPin className="size-4 text-[#4dbdc6] mb-1" />
                <span className="text-[11px] font-extrabold">Nawiguj</span>
              </a>
            ) : (
              <button
                disabled
                className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-300 text-center opacity-50 cursor-not-allowed"
              >
                <MapPin className="size-4 mb-1" />
                <span className="text-[11px] font-extrabold">Nawiguj</span>
              </button>
            )}

            {phoneUrl ? (
              <a
                href={phoneUrl}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 active:scale-95 transition text-center"
              >
                <Phone className="size-4 text-emerald-600 mb-1" />
                <span className="text-[11px] font-extrabold">Zadzwoń</span>
              </a>
            ) : (
              <button
                disabled
                className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-300 text-center opacity-50 cursor-not-allowed"
              >
                <Phone className="size-4 mb-1" />
                <span className="text-[11px] font-extrabold">Zadzwoń</span>
              </button>
            )}

            {orderHref ? (
              <a
                href={orderHref}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 hover:bg-blue-100 active:scale-95 transition text-center"
              >
                <ExternalLink className="size-4 text-blue-600 mb-1" />
                <span className="text-[11px] font-extrabold">Zlecenie</span>
              </a>
            ) : (
              <button
                disabled
                className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-300 text-center opacity-50 cursor-not-allowed"
              >
                <ExternalLink className="size-4 mb-1" />
                <span className="text-[11px] font-extrabold">Zlecenie</span>
              </button>
            )}
          </div>

          {/* Address info if available */}
          {item.address && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 font-medium">
              <MapPin className="size-4 text-[#4dbdc6] shrink-0" />
              <span>{item.address}</span>
            </div>
          )}

          {/* Quick Status Selector (For Orders) */}
          {!isCustomEvent && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Status wydarzenia / zlecenia
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: "measurement", label: "Pomiar", color: "bg-blue-50 text-blue-700 border-blue-200" },
                  { key: "installation", label: "W trakcie", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                  { key: "completed", label: "Zakończone", color: "bg-purple-50 text-purple-700 border-purple-200" },
                  { key: "cancelled", label: "Anulowane", color: "bg-red-50 text-red-700 border-red-200" },
                ].map((s) => {
                  const isActive = status === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setStatus(s.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition ${
                        isActive
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                          : `${s.color} hover:opacity-80`
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Date & Time Fields */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Termin i godzina
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Calendar className="size-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#4dbdc6]"
                />
              </div>

              <div className="relative">
                <Clock className="size-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="time"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#4dbdc6]"
                />
              </div>
            </div>
          </div>

          {/* Installation Team Selector */}
          {!isCustomEvent && teams && teams.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Przypisana ekipa montażowa
              </label>
              <div className="relative">
                <Users className="size-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#4dbdc6]"
                >
                  <option value="">Zachowaj obecną ekipę</option>
                  {teams.map((team) => (
                    <option key={team._id} value={team._id}>
                      {team.name} {team.leaderName ? `(${team.leaderName})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Notes / Progress comment */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Notatka z przebiegu prac / Uwagi
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Wpisz uwagi z montażu, ustalenia lub opis wykonanych prac..."
              className="w-full p-3 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#4dbdc6] resize-none"
            />
          </div>

          {/* Photo attachment / Camera upload */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Fotorelacja z prac / Zdjęcia
            </label>

            <div className="flex items-center gap-2">
              <label className="flex-1 flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 transition cursor-pointer active:scale-98">
                <Camera className="size-4 text-[#4dbdc6]" />
                <span>Zrób zdjęcie lub dodaj z galerii</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </label>
            </div>

            {/* Photo previews list */}
            {photoPreviews.length > 0 && (
              <div className="grid grid-cols-4 gap-2 pt-2">
                {photoPreviews.map((src, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Zdjęcie ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow-md hover:bg-red-700 transition"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Action Buttons */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            disabled={isDeleting || isSaving}
            onClick={handleDeleteOrCancel}
            className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 active:scale-95 transition flex items-center gap-1.5 disabled:opacity-50"
          >
            {isDeleting ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            <span>{isCustomEvent ? "Usuń" : "Anuluj"}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
            >
              Zamknij
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-[#4dbdc6] hover:bg-[#3daab3] active:scale-95 transition shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="size-4 animate-spin" />
                  <span>Zapisywanie...</span>
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  <span>Zapisz Zmiany</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
