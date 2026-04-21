"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useStatusLabels } from "@/components/StatusLabelsContext";
import { StatusBadge } from "@/components/ui/Badge";
import Link from "next/link";
import { CLIENT_STATUSES } from "@/convex/schema";
import { Users, UserPlus, ClipboardList, CheckCircle } from "lucide-react";

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "przed chwilą";
  if (min < 60) return `${min} min temu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} godz. temu`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} dni temu`;
  return new Date(ts).toLocaleDateString("pl-PL");
}

function formatEventLabel(
  event: { type: string; details?: unknown },
  labels: Record<string, string>,
): string {
  const details = event.details as Record<string, string> | undefined;
  switch (event.type) {
    case "created":
      return "Nowy klient";
    case "order_created":
      return "Nowe zlecenie";
    case "status_changed": {
      const from = details?.from;
      const to = details?.to;
      if (from && to)
        return `Status: ${labels[from] ?? from} → ${labels[to] ?? to}`;
      return "Zmiana statusu";
    }
    case "data_updated":
      return "Dane zaktualizowane";
    case "document_generated":
      return "Dokument wygenerowany";
    case "document_uploaded":
      return "Dokument dodany";
    case "document_removed":
      return "Dokument usunięty";
    case "warranty_card_added":
      return "Karta gwarancyjna";
    case "fakturownia_estimate_created":
      return "Kosztorys w Fakturowni";
    case "fakturownia_estimate_updated":
      return "Kosztorys zaktualizowany";
    case "folder_created":
      return "Folder Drive";
    default:
      return event.type;
  }
}

function KpiCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <Icon className="size-5 text-gray-400" />
      </div>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

export default function DashboardContent() {
  const stats = useQuery(api.dashboard.getStats);
  const events = useQuery(api.dashboard.getRecentEvents);
  const labels = useStatusLabels();

  if (!stats || !events) {
    return (
      <div className="space-y-8 animate-pulse">
        <div>
          <div className="h-7 w-36 rounded bg-gray-200" />
          <div className="mt-1 h-4 w-56 rounded bg-gray-100" />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-lg border border-gray-200 bg-gray-100" />
          ))}
        </div>
        <div className="h-40 rounded-lg border border-gray-200 bg-gray-100" />
        <div className="h-64 rounded-lg border border-gray-200 bg-gray-100" />
      </div>
    );
  }

  const activeStatuses = [
    "lead",
    "inquiry",
    "measurement",
    "offer",
    "contract",
    "production",
    "installation",
  ];
  const activeCount = activeStatuses.reduce(
    (sum, s) => sum + (stats.byStatus[s] ?? 0),
    0,
  );
  const closedCount =
    (stats.byStatus.completed ?? 0) + (stats.byStatus.complaint ?? 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Przegląd aktywności systemu.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Klienci łącznie" value={stats.total} icon={Users} />
        <KpiCard
          label="Nowi w tym tygodniu"
          value={stats.newThisWeek}
          icon={UserPlus}
        />
        <KpiCard
          label="Aktywne zlecenia"
          value={activeCount}
          icon={ClipboardList}
        />
        <KpiCard
          label="Zakończone / Gwarancja"
          value={closedCount}
          icon={CheckCircle}
        />
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold text-gray-900">
          Pipeline zleceń
        </h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {CLIENT_STATUSES.map((status) => (
            <div
              key={status}
              className="rounded-lg border border-gray-200 bg-white p-3 text-center"
            >
              <p className="text-2xl font-bold text-gray-900">
                {stats.byStatus[status] ?? 0}
              </p>
              <div className="mt-2 flex justify-center">
                <StatusBadge status={status} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold text-gray-900">
          Ostatnia aktywność
        </h2>
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {events.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">Brak aktywności.</p>
          ) : (
            events.map((event) => (
              <div key={event._id} className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-900">
                    <Link
                      href={`/admin/klient/${event.clientId}`}
                      className="font-medium hover:underline"
                    >
                      {event.clientName}
                    </Link>
                    <span className="text-gray-500">
                      {" — "}
                      {formatEventLabel(event, labels)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {relativeTime(event._creationTime)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
