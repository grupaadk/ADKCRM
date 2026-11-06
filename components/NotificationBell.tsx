"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Bell, CheckCheck, TrendingUp, MessageSquare, X, BellOff, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import type { Id } from "@/convex/_generated/dataModel";

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 60) return "przed chwilą";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min temu`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} godz. temu`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "wczoraj";
  if (diffDays < 7) return `${diffDays} dni temu`;
  return new Date(timestamp).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
  });
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const notifications = useQuery(api.notifications.list, { limit: 30 });
  const unreadCount = useQuery(api.notifications.getUnreadCount) ?? 0;

  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);
  const deleteNotification = useMutation(api.notifications.deleteNotification);

  // Śledzenie widzianych powiadomień, aby pokazać toast tylko dla nowych powiadomień w trakcie sesji
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);

  useEffect(() => {
    if (!notifications) return;

    if (!initialLoadDoneRef.current) {
      notifications.forEach((n) => seenIdsRef.current.add(n._id));
      initialLoadDoneRef.current = true;
      return;
    }

    // Sprawdź czy pojawiło się nowe nieprzeczytane powiadomienie
    for (const item of notifications) {
      if (!seenIdsRef.current.has(item._id)) {
        seenIdsRef.current.add(item._id);

        if (!item.read) {
          const isMessage = item.type === "order_message" || item.entityType === "order";
          toast(
            (t) => (
              <div className="flex items-start gap-2.5 max-w-sm">
                <div
                  className={`p-1.5 rounded-md shrink-0 mt-0.5 ${
                    isMessage ? "bg-blue-500/10 text-blue-600" : "bg-teal-500/10 text-teal-600"
                  }`}
                >
                  {isMessage ? <MessageSquare size={16} /> : <TrendingUp size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-500 truncate">{item.message}</p>
                  {item.link && (
                    <button
                      onClick={() => {
                        toast.dismiss(t.id);
                        if (item.link) router.push(item.link);
                      }}
                      className={`mt-1.5 text-[11px] font-medium flex items-center gap-1 ${
                        isMessage
                          ? "text-blue-600 hover:text-blue-700"
                          : "text-teal-600 hover:text-teal-700"
                      }`}
                    >
                      {isMessage ? "Zobacz wiadomość" : "Zobacz szansę"} <ArrowRight size={11} />
                    </button>
                  )}
                </div>
              </div>
            ),
            {
              duration: 5000,
              position: "top-right",
            },
          );
        }
      }
    }
  }, [notifications, router]);

  // Zamknięcie po kliknięciu na zewnątrz
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleNotificationClick = async (item: {
    _id: Id<"notifications">;
    read: boolean;
    link?: string;
  }) => {
    if (!item.read) {
      try {
        await markAsRead({ notificationId: item._id });
      } catch (e) {
        console.error("Błąd oznaczania powiadomienia jako przeczytane:", e);
      }
    }
    setOpen(false);
    if (item.link) {
      router.push(item.link);
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllAsRead({});
    } catch (e) {
      console.error("Błąd oznaczania wszystkich powiadomień:", e);
    }
  };

  const handleDelete = async (
    e: React.MouseEvent,
    notificationId: Id<"notifications">,
  ) => {
    e.stopPropagation();
    try {
      await deleteNotification({ notificationId });
    } catch (e) {
      console.error("Błąd usuwania powiadomienia:", e);
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="btn ghost icon relative flex items-center justify-center cursor-pointer transition-colors"
        title="Powiadomienia"
        style={{
          position: "relative",
          width: 32,
          height: 32,
          borderRadius: "var(--radius)",
        }}
      >
        <Bell size={15} style={{ color: "var(--text)" }} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center font-bold rounded-full pointer-events-none"
            style={{
              background: "#ef4444",
              color: "#ffffff",
              fontSize: "10px",
              minWidth: "16px",
              height: "16px",
              padding: "0 4px",
              lineHeight: 1,
              boxShadow: "0 0 0 2px var(--background)",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[360px] max-w-[90vw] z-50 overflow-hidden shadow-xl"
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "10px",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3.5 py-2.5 border-b"
            style={{ borderColor: "var(--line)" }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-strong" style={{ color: "var(--text-strong)" }}>
                Powiadomienia
              </span>
              {unreadCount > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                  style={{
                    background: "var(--accent-soft)",
                    color: "var(--brand-hover)",
                  }}
                >
                  {unreadCount} nowe
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                className="flex items-center gap-1 text-[11px] font-medium cursor-pointer transition-opacity hover:opacity-80"
                style={{ color: "var(--brand)" }}
                title="Oznacz wszystkie jako przeczytane"
              >
                <CheckCheck size={13} />
                <span>Przeczytane</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y" style={{ borderColor: "var(--line)" }}>
            {!notifications || notifications.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <BellOff size={24} className="mx-auto mb-2 opacity-30" style={{ color: "var(--text-mute)" }} />
                <p className="text-xs font-medium" style={{ color: "var(--text-strong)" }}>
                  Brak powiadomień
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-mute)" }}>
                  Nowe szanse sprzedaży i zdarzenia pojawią się tutaj.
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const isUnread = !item.read;
                const isMessage = item.type === "order_message" || item.entityType === "order";
                return (
                  <div
                    key={item._id}
                    onClick={() => handleNotificationClick(item)}
                    className="group relative flex items-start gap-3 p-3 transition-colors cursor-pointer text-left"
                    style={{
                      background: isUnread
                        ? isMessage ? "rgba(59, 130, 246, 0.05)" : "rgba(74, 187, 195, 0.05)"
                        : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isUnread
                        ? isMessage ? "rgba(59, 130, 246, 0.09)" : "rgba(74, 187, 195, 0.09)"
                        : "var(--panel-2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isUnread
                        ? isMessage ? "rgba(59, 130, 246, 0.05)" : "rgba(74, 187, 195, 0.05)"
                        : "transparent";
                    }}
                  >
                    {/* Icon */}
                    <div
                      className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
                      style={{
                        background: isUnread
                          ? isMessage ? "rgba(59, 130, 246, 0.15)" : "rgba(74, 187, 195, 0.15)"
                          : "var(--panel-3)",
                        color: isUnread
                          ? isMessage ? "#2563eb" : "var(--brand-hover)"
                          : "var(--text-mute)",
                      }}
                    >
                      {isMessage ? <MessageSquare size={14} /> : <TrendingUp size={14} />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-1.5">
                        <p
                          className={`text-xs truncate ${
                            isUnread ? "font-semibold" : "font-normal"
                          }`}
                          style={{
                            color: isUnread ? "var(--text-strong)" : "var(--text)",
                          }}
                        >
                          {item.title}
                        </p>
                        {isUnread && (
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: "var(--brand)" }}
                          />
                        )}
                      </div>

                      <p
                        className="text-[11px] line-clamp-2 mt-0.5 leading-snug"
                        style={{ color: "var(--text-dim)" }}
                      >
                        {item.message}
                      </p>

                      <span
                        className="inline-block text-[10px] mt-1"
                        style={{ color: "var(--text-mute)" }}
                      >
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>

                    {/* Delete button (visible on hover) */}
                    <button
                      onClick={(e) => handleDelete(e, item._id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 absolute top-2.5 right-2"
                      style={{ color: "var(--text-mute)" }}
                      title="Usuń powiadomienie"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export default NotificationBell;
