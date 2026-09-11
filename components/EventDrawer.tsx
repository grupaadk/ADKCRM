"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import SideDrawer from "@/components/SideDrawer";
import {
  X,
  MapPin,
  Phone,
  ExternalLink,
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
  const router = useRouter();
  const statuses = useStatuses();

  // Queries
  const teams = useQuery(api.installationTeams.listActive);

  // Mutations
  const updateOrder = useMutation(api.orders.update);
  const changeOrderStatus = useMutation(api.orders.changeStatus);
  const updateCalendarEvent = useMutation(api.calendarEvents.updateEvent);
  const deleteCalendarEvent = useMutation(api.calendarEvents.deleteEvent);

  // State
  const [title, setTitle] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");
  const [timeStr, setTimeStr] = useState<string>("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  const [, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Populate state when item changes
  useEffect(() => {
    if (item) {
      setTitle(item.title || "");
      setStatus(item.status || "measurement");
      setComment(item.comment || item.description || "");
      setSelectedTeamId("");
      setPhotos([]);
      setPhotoPreviews([]);
      setConfirmDelete(false);

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

  if (!item) return null;

  // Extract real orderId if item.id has format orderId_inst_X
  const realOrderId = item.orderId
    ? item.orderId
    : item.id.includes("_inst_")
    ? (item.id.split("_inst_")[0] as Id<"orders">)
    : item.type === "montaz" || item.type === "serwis"
    ? (item.id as Id<"orders">)
    : null;

  const isCustomEvent = item.type === "wlasne" || !realOrderId;

  // Photo selection with compression
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
          title: title || item.title,
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
          name: title,
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

      setConfirmDelete(false);
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
  const openHref = realOrderId ? `/app/zlecenie/${realOrderId}?from=home` : null;

  const contextLabel =
    item.type === "montaz"
      ? "Montaż stolarki"
      : item.type === "serwis"
      ? "Zgłoszenie serwisowe"
      : "Wydarzenie w kalendarzu";

  return (
    <SideDrawer
      open={isOpen}
      onClose={onClose}
      title="Szczegóły wydarzenia"
      width={480}
      footer={
        confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="flex-1 text-sm font-medium text-gray-700">
              {isCustomEvent ? "Usunąć wydarzenie z kalendarza?" : "Anulować zlecenie?"}
            </span>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="shrink-0 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Anuluj
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleDeleteOrCancel}
              className="flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isDeleting ? <RefreshCw className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {isCustomEvent ? "Usuń" : "Anuluj zlecenie"}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                title="Usuń / Anuluj wydarzenie"
                className="flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <Trash2 className="size-4" /> Usuń
              </button>

              {openHref && (
                <button
                  type="button"
                  onClick={() => router.push(openHref)}
                  className="flex items-center justify-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <ExternalLink className="size-4" /> Otwórz zlecenie
                </button>
              )}
            </div>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="flex items-center justify-center gap-1.5 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="size-4 animate-spin" /> : <Check className="size-4" />}
              Zapisz Zmiany
            </button>
          </div>
        )
      }
    >
      <div className="flex flex-col">
        {/* Top Context Bar (matching TaskDrawer style) */}
        <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              {contextLabel}
            </div>
            {item.status && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                {statuses.find((s) => s.key === item.status)?.label || item.status}
              </span>
            )}
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-900">{item.clientName}</div>
            <div className="text-xs text-gray-500 font-medium">{item.title}</div>
          </div>

          {/* Quick Contact & Navigation Buttons */}
          <div className="flex items-center gap-2 pt-1">
            {mapUrl && (
              <a
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <MapPin className="size-3.5 text-blue-600" /> Nawiguj
              </a>
            )}

            {phoneUrl && (
              <a
                href={phoneUrl}
                className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-gray-50"
              >
                <Phone className="size-3.5 text-emerald-600" /> Zadzwoń
              </a>
            )}

            {openHref && (
              <a
                href={openHref}
                className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <ExternalLink className="size-3.5 text-gray-500" /> Zlecenie
              </a>
            )}
          </div>

          {item.address && (
            <div className="text-[11px] text-gray-500 truncate flex items-center gap-1 pt-1 border-t border-gray-200/60">
              <MapPin className="size-3 text-gray-400 shrink-0" />
              <span>{item.address}</span>
            </div>
          )}
        </div>

        {/* Form Body Fields (matching TaskDrawer style) */}
        <div className="space-y-5 px-5 py-4">
          {/* Tytuł wydarzenia */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Nazwa / Tytuł
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
            />
          </div>

          {/* Status selector (for Orders) */}
          {!isCustomEvent && (
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Status
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: "measurement", label: "Pomiar", accent: "#2563eb", bg: "#eff6ff" },
                  { key: "installation", label: "W trakcie", accent: "#10b981", bg: "#ecfdf5" },
                  { key: "completed", label: "Zakończone", accent: "#16a34a", bg: "#f0fdf4" },
                  { key: "cancelled", label: "Anulowane", accent: "#ef4444", bg: "#fef2f2" },
                ].map((s) => {
                  const active = status === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setStatus(s.key)}
                      className="flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors"
                      style={
                        active
                          ? { borderColor: s.accent, background: s.bg, color: s.accent }
                          : { borderColor: "#e5e7eb", background: "#fff", color: "#6b7280" }
                      }
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Date and Time Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Data
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-900 outline-none focus:border-gray-400"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Godzina
              </label>
              <div className="relative">
                <input
                  type="time"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-900 outline-none focus:border-gray-400"
                />
              </div>
            </div>
          </div>

          {/* Ekipa Montażowa */}
          {!isCustomEvent && teams && teams.length > 0 && (
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Ekipa Montażowa
              </label>
              <div className="relative">
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-900 outline-none focus:border-gray-400 bg-white"
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

          {/* Uwagi / Notatka z montażu */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Notatki / Uwagi z przebiegu prac
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Wpisz uwagi z montażu, ustalenia lub opis wykonanych prac..."
              className="w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
            />
          </div>

          {/* Zdjęcia z montażu */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Fotorelacja z prac / Zdjęcia
            </label>

            <label className="flex items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 transition cursor-pointer">
              <Camera className="size-4 text-blue-600" />
              <span>Zrób zdjęcie lub wybierz z galerii</span>
              <input
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </label>

            {photoPreviews.length > 0 && (
              <div className="grid grid-cols-4 gap-2 pt-3">
                {photoPreviews.map((src, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-md overflow-hidden border border-gray-200 bg-gray-100 group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Zdjęcie ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-1 right-1 rounded-full bg-red-600 p-1 text-white shadow-sm hover:bg-red-700"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </SideDrawer>
  );
}
