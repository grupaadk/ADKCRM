"use client";

import { Doc } from "@/convex/_generated/dataModel";
import { useStatusLabels } from "@/components/StatusLabelsContext";

function formatEventType(
  type: string,
  details: Record<string, unknown> | undefined,
  statusLabels: Record<string, string>,
): string {
  switch (type) {
    case "created":
      return "Utworzono klienta";
    case "status_changed": {
      const from =
        statusLabels[(details?.from as string) ?? ""] ?? details?.from;
      const to = statusLabels[(details?.to as string) ?? ""] ?? details?.to;
      return `Zmiana statusu: ${from} \u2192 ${to}`;
    }
    case "document_generated":
      return `Wygenerowano dokument: ${details?.documentType ?? ""}`;
    case "document_removed":
      return `Usunieto dokument: ${details?.documentType ?? ""}`;
    case "data_updated":
      return "Zaktualizowano dane";
    case "warranty_card_added":
      return `Dodano karte gwarancyjna: ${details?.manufacturer ?? ""}`;
    case "folder_created":
      return "Utworzono folder Google Drive";
    case "fakturownia_estimate_created": {
      const num = details?.number as string | undefined;
      const recreated = details?.recreated as boolean | undefined;
      const label = num ? ` (${num})` : "";
      return recreated
        ? `Odtworzono zamówienie w Fakturowni${label}`
        : `Wysłano zamówienie do Fakturowni${label}`;
    }
    case "fakturownia_estimate_updated": {
      const num = details?.number as string | undefined;
      return `Zaktualizowano zamówienie w Fakturowni${num ? ` (${num})` : ""}`;
    }
    default:
      return type;
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface EventTimelineProps {
  events: Doc<"clientEvents">[] | undefined;
}

export default function EventTimeline({ events }: EventTimelineProps) {
  const statusLabels = useStatusLabels();

  if (!events || events.length === 0) {
    return <p className="text-sm text-slate-400 italic">Brak zdarzen.</p>;
  }

  return (
    <div className="relative">
      <div className="absolute bottom-0 left-3 top-0 w-px bg-slate-200" />
      <ul className="flex flex-col gap-4">
        {events.map((event) => (
          <li
            key={event._id}
            className="relative rounded-xl border border-slate-200 bg-slate-50 p-4 pl-8"
          >
            <div className="absolute left-1.5 top-5 h-3 w-3 rounded-full border-2 border-white bg-slate-400" />
            <div className="text-sm font-medium text-slate-900">
              {formatEventType(
                event.type,
                event.details as Record<string, unknown> | undefined,
                statusLabels,
              )}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs text-slate-500">
                {formatTime(event._creationTime)}
              </span>
              <span className="text-xs text-slate-400">
                {event.performedBy === "system"
                  ? "system"
                  : event.performedBy.slice(0, 12)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
