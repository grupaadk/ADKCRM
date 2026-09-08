"use client";

import { use, useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useStatuses } from "@/components/StatusLabelsContext";
import { deriveStatusStyle } from "@/lib/statuses";
import {
  ArrowLeft,
  Phone,
  MapPin,
  ExternalLink,
  Calendar,
  Users,
  AlertTriangle,
  FileText,
  DollarSign,
  ShieldAlert,
  Send,
  Building2,
  Mail,
  FolderOpen,
  MessageSquare,
} from "lucide-react";

const DOC_KEYS = [
  "pomiar",
  "umowa",
  "gwarancja_alco",
  "odbior_inwestor",
  "protokol_montaz",
  "faktura",
  "reklamacja",
] as const;

const DOC_NAMES: Record<string, string> = {
  pomiar: "Pomiar",
  umowa: "Umowa",
  gwarancja_alco: "Gwarancja ALCO",
  odbior_inwestor: "Odbiór inwestor",
  protokol_montaz: "Protokół montażu",
  faktura: "Faktura",
  reklamacja: "Reklamacja",
};

const DOC_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  gray: { bg: "bg-slate-100", text: "text-slate-500", label: "Brak / W trakcie" },
  red: { bg: "bg-red-100", text: "text-red-700", label: "Wymaga uwagi" },
  green: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Zrobione" },
};

const SERVICE_COLORS = [
  { bg: "#ede9fe", text: "#6d28d9" },
  { bg: "#dbeafe", text: "#1d4ed8" },
  { bg: "#dcfce7", text: "#15803d" },
  { bg: "#fef3c7", text: "#b45309" },
  { bg: "#fce7f3", text: "#be185d" },
  { bg: "#e0f2fe", text: "#0369a1" },
];

export default function MobileOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const router = useRouter();
  const orderIdTyped = orderId as Id<"orders">;

  const order = useQuery(api.orders.getById, { orderId: orderIdTyped });
  const client = useQuery(api.clients.getById, order ? { clientId: order.clientId } : "skip");
  const notes = useQuery(api.notes.listByOrder, { orderId: orderIdTyped }) ?? [];
  const invoices = useQuery(api.fakturownia.listCachedInvoicesByOrder, { orderId: orderIdTyped }) ?? [];
  const expenses = useQuery(api.fakturownia.listCachedExpensesByOrder, { orderId: orderIdTyped }) ?? [];
  const complaints = useQuery(api.complaints.listByOrder, { orderId: orderIdTyped }) ?? [];
  const teams = useQuery(api.installationTeams.listAll) ?? [];
  const statuses = useStatuses();

  const changeStatus = useMutation(api.orders.changeStatus);
  const addNote = useMutation(api.notes.add);

  const [newNoteText, setNewNoteText] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);

  const clientName = useMemo(() => {
    if (!client) return "Ładowanie...";
    if (client.clientType === "business" && client.companyName) {
      return client.companyName;
    }
    return `${client.firstName} ${client.lastName}`.trim();
  }, [client]);

  const fullAddress = useMemo(() => {
    if (!order) return "";
    const street = order.investmentStreet || client?.addressStreet;
    const city = order.investmentCity || client?.addressCity;
    const postal = order.investmentPostalCode || client?.addressPostalCode;
    return [street, postal, city].filter(Boolean).join(", ");
  }, [order, client]);

  const mapsUrl = useMemo(() => {
    if (!fullAddress) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
  }, [fullAddress]);

  const currentStatusDef = useMemo(() => {
    if (!order) return null;
    return statuses.find((s) => s.key === order.status) ?? {
      key: order.status,
      label: order.status,
      color: "#4abbc3",
      sortOrder: 0,
      hidden: false,
      isCore: true,
      kind: "order",
    };
  }, [statuses, order]);

  const statusStyle = useMemo(() => {
    return currentStatusDef ? deriveStatusStyle(currentStatusDef.color) : null;
  }, [currentStatusDef]);

  const assignedTeam = useMemo(() => {
    if (!order?.assignedInstallationTeamId) return null;
    return teams.find((t) => t._id === order.assignedInstallationTeamId);
  }, [order, teams]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || !order) return;
    setSubmittingNote(true);
    try {
      await addNote({
        clientId: order.clientId,
        orderId: order._id,
        text: newNoteText.trim(),
      });
      setNewNoteText("");
    } catch {
      alert("Błąd dodawania notatki");
    } finally {
      setSubmittingNote(false);
    }
  };

  if (order === undefined || client === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="animate-spin size-8 border-4 border-[#4abbc3] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (order === null) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center text-center space-y-4">
        <AlertTriangle className="size-12 text-amber-500" />
        <h1 className="text-lg font-bold text-slate-800">Zlecenie nie zostało znalezione</h1>
        <p className="text-sm text-slate-500">Zlecenie mogło zostać usunięte lub nie masz do niego dostępu.</p>
        <button
          onClick={() => router.push("/app")}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs"
        >
          Wróć do Panelu
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-16 text-slate-900 antialiased">
      {/* Top Mobile Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-200/80 px-4 py-3 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => router.push("/app")}
            className="flex items-center gap-1 text-slate-600 hover:text-slate-900 font-bold text-xs p-1 -ml-1 rounded-lg active:bg-slate-100"
          >
            <ArrowLeft className="size-4" />
            <span>Panel</span>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            {order.clientId && (
              <Link
                href={`/admin/klient/${order.clientId}/zlecenie/${order._id}`}
                className="flex items-center gap-1 text-[11px] font-bold text-[#2c8a90] bg-[#4abbc3]/10 border border-[#4abbc3]/30 px-2 py-1 rounded-lg active:scale-95 transition"
              >
                <span>Pełny panel</span>
                <ExternalLink className="size-3" />
              </Link>
            )}
          </div>
        </div>

        {/* Dynamic Title and Status */}
        <div className="mt-2.5 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-base font-extrabold text-slate-900 truncate">
              {order.name || "Zlecenie bez nazwy"}
            </h1>

            {statusStyle && (
              <span
                className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full border shadow-2xs"
                style={{
                  backgroundColor: statusStyle.bg,
                  color: statusStyle.text,
                  borderColor: statusStyle.border,
                }}
              >
                {currentStatusDef?.label}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium truncate">{clientName}</p>
        </div>
      </header>

      {/* Content Body */}
      <main className="p-3.5 space-y-3 max-w-xl mx-auto">
        {/* Quick Action Bar (Zadzwoń, Nawiguj, Status) */}
        <div className="bg-white rounded-2xl p-3 border border-gray-200/90 shadow-xs space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            {client?.phone ? (
              <a
                href={`tel:${client.phone}`}
                className="flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-xl py-2.5 px-3 font-bold text-xs shadow-xs active:scale-98 transition"
              >
                <Phone className="size-4" />
                <span>Zadzwoń</span>
              </a>
            ) : (
              <button
                disabled
                className="flex items-center justify-center gap-2 bg-slate-100 text-slate-400 rounded-xl py-2.5 px-3 font-bold text-xs cursor-not-allowed"
              >
                <Phone className="size-4" />
                <span>Brak telefonu</span>
              </button>
            )}

            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl py-2.5 px-3 font-bold text-xs shadow-xs active:scale-98 transition"
              >
                <MapPin className="size-4" />
                <span>Nawiguj</span>
              </a>
            ) : (
              <button
                disabled
                className="flex items-center justify-center gap-2 bg-slate-100 text-slate-400 rounded-xl py-2.5 px-3 font-bold text-xs cursor-not-allowed"
              >
                <MapPin className="size-4" />
                <span>Brak adresu</span>
              </button>
            )}
          </div>

          {/* Quick status selector */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
              Zmień status zlecenia:
            </label>
            <select
              value={order.status}
              onChange={(e) => changeStatus({ orderId: order._id, newStatus: e.target.value as any })}
              className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#4abbc3]"
            >
              {statuses.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Section 1: Klient & Inwestycja */}
        <section className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="size-4 text-[#4abbc3]" /> Klient & Adres
            </h2>
            {order.grossAmount !== undefined && (
              <span className="text-sm font-extrabold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                {order.grossAmount.toLocaleString("pl-PL")} zł
              </span>
            )}
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <p className="font-extrabold text-slate-900 text-sm">{clientName}</p>
              {client?.clientType === "business" && client.nip && (
                <p className="text-slate-500 font-medium">NIP: {client.nip}</p>
              )}
            </div>

            {fullAddress && (
              <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-slate-700">
                <MapPin className="size-4 text-slate-400 shrink-0 mt-0.5" />
                <span className="font-semibold text-xs leading-relaxed">{fullAddress}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-slate-600">
              {client?.email && (
                <div className="flex items-center gap-1.5 text-xs truncate">
                  <Mail className="size-3.5 text-slate-400 shrink-0" />
                  <a href={`mailto:${client.email}`} className="text-blue-600 underline font-medium truncate">
                    {client.email}
                  </a>
                </div>
              )}
              {client?.phone && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Phone className="size-3.5 text-slate-400 shrink-0" />
                  <span className="font-semibold">{client.phone}</span>
                </div>
              )}
            </div>

            {/* Usługi */}
            {order.services && order.services.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Usługi:</span>
                <div className="flex flex-wrap gap-1">
                  {order.services.map((s, idx) => {
                    const c = SERVICE_COLORS[idx % SERVICE_COLORS.length];
                    return (
                      <span
                        key={s}
                        className="rounded-md px-2 py-0.5 text-[11px] font-bold"
                        style={{ backgroundColor: c.bg, color: c.text }}
                      >
                        {s}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Section 2: Montaż & Ekipa */}
        <section className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="size-4 text-indigo-500" /> Montaż & Ekipa
          </h2>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between bg-indigo-50/60 border border-indigo-100 rounded-xl p-3">
              <div>
                <span className="text-[10px] font-bold text-indigo-500 uppercase block">Planowany termin:</span>
                <p className="font-extrabold text-indigo-950 text-xs">
                  {order.installationDate || "Nie wyznaczono terminu"}
                </p>
              </div>
              {order.installationStatus && (
                <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg text-[10px] font-extrabold border border-indigo-200 uppercase">
                  {order.installationStatus}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Users className="size-4 text-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Ekipa montażowa:</span>
                <p className="font-semibold text-slate-800 truncate">
                  {assignedTeam?.name || "Brak przypisanej ekipy"}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Dokumenty & Pliki Drive */}
        <section className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="size-4 text-emerald-500" /> Dokumenty Zlecenia
            </h2>
            {order.driveFolderUrl && (
              <a
                href={order.driveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg active:scale-95 transition"
              >
                <FolderOpen className="size-3.5" />
                <span>Google Drive</span>
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {DOC_KEYS.map((key) => {
              const st = (order.docs?.[key] as string) ?? "gray";
              const col = DOC_COLORS[st] ?? DOC_COLORS.gray;
              return (
                <div
                  key={key}
                  className={`flex items-center justify-between p-2.5 rounded-xl border ${col.bg} border-gray-200/50`}
                >
                  <span className="font-bold text-slate-800 text-[11px]">{DOC_NAMES[key]}</span>
                  <span className={`text-[10px] font-extrabold ${col.text}`}>{col.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 4: Notatki & Szybki komentarz */}
        <section className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <MessageSquare className="size-4 text-purple-500" /> Notatki ({notes.length})
          </h2>

          <form onSubmit={handleAddNote} className="flex gap-2">
            <input
              type="text"
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder="Napisz szybką notatkę..."
              className="flex-1 bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#4abbc3]"
            />
            <button
              type="submit"
              disabled={submittingNote || !newNoteText.trim()}
              className="bg-purple-600 text-white p-2 rounded-xl font-bold text-xs shadow-xs disabled:opacity-50 active:scale-95 transition"
            >
              <Send className="size-4" />
            </button>
          </form>

          {notes.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-2">Brak notatek w zleceniu</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {notes.map((n) => (
                <div key={n._id} className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 space-y-1">
                  <p className="text-xs text-slate-700 leading-relaxed">{n.text}</p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {new Date(n._creationTime).toLocaleString("pl-PL", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 5: Faktury & Koszty */}
        <section className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign className="size-4 text-amber-500" /> Finanse (Faktury: {invoices.length}, Koszty: {expenses.length})
          </h2>

          <div className="space-y-2 text-xs">
            {invoices.length === 0 && expenses.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-2">Brak pobranych faktur i kosztów</p>
            ) : (
              <>
                {invoices.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Faktury zlecenia:</span>
                    {invoices.map((inv) => (
                      <div
                        key={inv._id}
                        className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100"
                      >
                        <div>
                          <p className="font-bold text-slate-800 text-xs">{inv.number || "Faktura"}</p>
                          <p className="text-[10px] text-slate-400">{inv.issueDate || "—"}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-slate-900 text-xs">
                            {inv.grossAmount?.toLocaleString("pl-PL") ?? 0} {inv.currency || "PLN"}
                          </p>
                          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            {inv.status || "—"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Section 6: Reklamacje */}
        {complaints.length > 0 && (
          <section className="bg-white rounded-2xl p-4 border border-red-200/90 shadow-xs space-y-3">
            <h2 className="text-xs font-bold text-red-600 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="size-4 text-red-600" /> Reklamacje ({complaints.length})
            </h2>

            <div className="space-y-2">
              {complaints.map((c) => (
                <div key={c._id} className="bg-red-50/50 p-2.5 rounded-xl border border-red-100 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-red-950">{c.title || "Reklamacja"}</span>
                    <span className="text-[10px] font-extrabold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                      {c.status}
                    </span>
                  </div>
                  {c.description && <p className="text-xs text-slate-600 leading-snug">{c.description}</p>}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
