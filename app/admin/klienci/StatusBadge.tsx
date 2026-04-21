"use client";

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  lead: { label: "Lead", bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300" },
  inquiry: {
    label: "Oferta wysłana",
    bg: "bg-purple-100",
    text: "text-purple-800",
    border: "border-purple-300",
  },
  measurement: {
    label: "Do pomiarów",
    bg: "bg-amber-100",
    text: "text-amber-800",
    border: "border-amber-300",
  },
  offer: {
    label: "Oferta po pomiarze",
    bg: "bg-orange-100",
    text: "text-orange-800",
    border: "border-orange-300",
  },
  contract: { label: "Umowa", bg: "bg-green-100", text: "text-green-800", border: "border-green-300" },
  production: {
    label: "Produkcja",
    bg: "bg-violet-100",
    text: "text-violet-800",
    border: "border-violet-300",
  },
  installation: {
    label: "Montaż",
    bg: "bg-teal-100",
    text: "text-teal-800",
    border: "border-teal-300",
  },
  completed: {
    label: "Zakończone",
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    border: "border-emerald-300",
  },
  complaint: {
    label: "Reklamacja",
    bg: "bg-cyan-100",
    text: "text-cyan-800",
    border: "border-cyan-300",
  },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    bg: "bg-gray-100",
    text: "text-gray-800",
    border: "border-gray-300",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${config.bg} ${config.text} ${config.border ?? ""}`}
    >
      {config.label}
    </span>
  );
}

export function getStatusLabel(status: string): string {
  return STATUS_CONFIG[status]?.label ?? status;
}

export { STATUS_CONFIG };
