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
  Receipt,
  ShoppingCart,
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

const INVOICE_PLAN_LABELS: Record<string, string> = {
  vat: "Faktura VAT 100%",
  advance_final: "Zaliczka + Końcowa",
  advance_2_final: "2 Zaliczki + Końcowa",
};

function formatDate(ts?: number | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function MobileOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const router = useRouter();
  const orderIdTyped = orderId as Id<"orders">;

  // Convex Queries
  const order = useQuery(api.orders.getById, { orderId: orderIdTyped });
  const client = useQuery(api.clients.getById, order ? { clientId: order.clientId } : "skip");
  const lineItemsRes = useQuery(api.orderLineItems.listByOrder, { orderId: orderIdTyped });
  const invoices = useQuery(api.fakturownia.listCachedInvoicesByOrder, { orderId: orderIdTyped }) ?? [];
  const expenses = useQuery(api.fakturownia.listCachedExpensesByOrder, { orderId: orderIdTyped }) ?? [];
  const complaints = useQuery(api.complaints.getAllByOrder, { orderId: orderIdTyped }) ?? [];
  const suppliers = useQuery(api.suppliers.listActive) ?? [];
  const teams = useQuery(api.installationTeams.listAll) ?? [];
  const notes = useQuery(api.notes.listByOrder, { orderId: orderIdTyped }) ?? [];
  const statuses = useStatuses();

  // Mutations
  const changeStatus = useMutation(api.orders.changeStatus);
  const addNote = useMutation(api.notes.add);

  // Local State
  const [newNoteText, setNewNoteText] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);

  // Scroll to section helper
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Maps & calculations
  const supplierMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of suppliers) {
      map[s._id] = s.name;
    }
    return map;
  }, [suppliers]);

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

  const lineItems = lineItemsRes?.items ?? [];
  const lineItemsTotals = lineItemsRes?.totals ?? { totalNet: 0, totalGross: 0, totalVat: 0 };

  // Financial calculations
  const totalPaidInvoices = useMemo(() => {
    return invoices
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + (i.grossAmount ?? 0), 0);
  }, [invoices]);

  const totalExpensesGross = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (e.grossAmount ?? 0), 0);
  }, [expenses]);

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
      <div className="h-full w-full bg-slate-50 flex items-center justify-center p-4">
        <div className="animate-spin size-8 border-4 border-[#4abbc3] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (order === null) {
    return (
      <div className="h-full w-full bg-slate-50 p-6 flex flex-col items-center justify-center text-center space-y-4">
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
    <div className="h-full w-full overflow-y-auto bg-slate-100 text-slate-900 antialiased pb-24 scroll-smooth">
      {/* Top Mobile Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200/80 px-4 py-3 shadow-2xs">
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
                className="flex items-center gap-1 text-[11px] font-bold text-[#2c8a90] bg-[#4abbc3]/10 border border-[#4abbc3]/30 px-2.5 py-1 rounded-lg active:scale-95 transition"
              >
                <span>Pełny panel</span>
                <ExternalLink className="size-3" />
              </Link>
            )}
          </div>
        </div>

        {/* Dynamic Title and Status */}
        <div className="mt-2 space-y-1">
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

      {/* Main Content Body */}
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

          {/* Quick Section Navigation Bar */}
          <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            <button
              onClick={() => scrollToSection("sekcja-klient")}
              className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold shrink-0 hover:bg-slate-200 active:scale-95 transition"
            >
              Klient
            </button>
            <button
              onClick={() => scrollToSection("sekcja-wycena")}
              className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-200/60 text-[11px] font-bold shrink-0 hover:bg-sky-100 active:scale-95 transition"
            >
              Wycena
            </button>
            <button
              onClick={() => scrollToSection("sekcja-finanse")}
              className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[11px] font-bold shrink-0 hover:bg-emerald-100 active:scale-95 transition"
            >
              Finanse
            </button>
            <button
              onClick={() => scrollToSection("sekcja-zamowienia")}
              className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200/60 text-[11px] font-bold shrink-0 hover:bg-amber-100 active:scale-95 transition"
            >
              Zamówienia
            </button>
            <button
              onClick={() => scrollToSection("sekcja-montaz")}
              className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/60 text-[11px] font-bold shrink-0 hover:bg-indigo-100 active:scale-95 transition"
            >
              Montaż
            </button>
            <button
              onClick={() => scrollToSection("sekcja-reklamacje")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 active:scale-95 transition ${
                complaints.length > 0
                  ? "bg-red-500 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-700 border border-slate-200"
              }`}
            >
              Reklamacje {complaints.length > 0 && `(${complaints.length})`}
            </button>
            <button
              onClick={() => scrollToSection("sekcja-dokumenty")}
              className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold shrink-0 hover:bg-slate-200 active:scale-95 transition"
            >
              Dokumenty
            </button>
            <button
              onClick={() => scrollToSection("sekcja-notatki")}
              className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200/60 text-[11px] font-bold shrink-0 hover:bg-purple-100 active:scale-95 transition"
            >
              Notatki ({notes.length})
            </button>
          </div>
        </div>

        {/* Sekcja 1: Klient & Inwestycja */}
        <section id="sekcja-klient" className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs space-y-3 scroll-mt-28">
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

        {/* Sekcja 2: Wyceny & Pozycje kosztorysu */}
        <section id="sekcja-wycena" className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs space-y-3 scroll-mt-28">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Receipt className="size-4 text-sky-500" /> Wycena ({lineItems.length} pozycji)
            </h2>
            <span className="text-xs font-extrabold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-100">
              Brutto: {lineItemsTotals.totalGross.toLocaleString("pl-PL")} zł
            </span>
          </div>

          {lineItems.length === 0 ? (
            <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
              Brak wprowadzonych pozycji wyceny
            </p>
          ) : (
            <div className="space-y-2">
              <div className="space-y-1.5">
                {lineItems.map((item, idx) => {
                  const discount = item.discountPercent ?? 0;
                  const itemNet = item.quantity * item.unitPrice * (1 - discount / 100);
                  const itemGross = itemNet * (1 + item.vatRate / 100);
                  return (
                    <div
                      key={item._id}
                      className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-start justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="font-bold text-slate-900 truncate">
                          {idx + 1}. {item.name}
                        </p>
                        {item.description && (
                          <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">
                            {item.description}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 font-medium">
                          {item.quantity} {item.unit} × {item.unitPrice.toLocaleString("pl-PL")} zł (VAT {item.vatRate}%)
                          {discount > 0 && <span className="text-amber-600 font-bold ml-1">-{discount}%</span>}
                        </p>
                      </div>
                      <span className="font-extrabold text-slate-900 shrink-0 text-xs pt-0.5">
                        {itemGross.toLocaleString("pl-PL", { maximumFractionDigits: 2 })} zł
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Podsumowanie wyceny */}
              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600 bg-slate-100/70 p-2.5 rounded-xl">
                <span>Netto: <b>{lineItemsTotals.totalNet.toLocaleString("pl-PL")} zł</b></span>
                <span>VAT: <b>{lineItemsTotals.totalVat.toLocaleString("pl-PL")} zł</b></span>
                <span className="font-bold text-slate-900">Razem: {lineItemsTotals.totalGross.toLocaleString("pl-PL")} zł</span>
              </div>
            </div>
          )}
        </section>

        {/* Sekcja 3: Finanse & Plan fakturowania */}
        <section id="sekcja-finanse" className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs space-y-3 scroll-mt-28">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="size-4 text-emerald-500" /> Finanse & Faktury
            </h2>
            {order.invoicePlan?.type && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {INVOICE_PLAN_LABELS[order.invoicePlan.type] ?? order.invoicePlan.type}
              </span>
            )}
          </div>

          <div className="space-y-2.5 text-xs">
            {/* Podsumowanie bilansu wpłat */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-2.5">
                <span className="text-[10px] font-bold text-emerald-600 uppercase block">Opłacono z faktur:</span>
                <p className="font-extrabold text-emerald-950 text-sm">
                  {totalPaidInvoices.toLocaleString("pl-PL")} zł
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Koszty całkowite:</span>
                <p className="font-extrabold text-slate-800 text-sm">
                  {totalExpensesGross.toLocaleString("pl-PL")} zł
                </p>
              </div>
            </div>

            {/* Lista pobranych faktur z Fakturowni */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Faktury Fakturownia ({invoices.length}):</span>
              {invoices.length === 0 ? (
                <p className="text-xs text-slate-400 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                  Brak faktur w systemie Fakturownia
                </p>
              ) : (
                invoices.map((inv) => (
                  <div
                    key={inv._id}
                    className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100"
                  >
                    <div>
                      <p className="font-bold text-slate-900 text-xs">{inv.number || "Faktura sin"}</p>
                      <p className="text-[10px] text-slate-400">{inv.issueDate || "—"} ({inv.kind})</p>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-slate-900 text-xs">
                        {inv.grossAmount?.toLocaleString("pl-PL") ?? 0} {inv.currency || "PLN"}
                      </p>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border inline-block mt-0.5 ${
                          inv.status === "paid"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : inv.status === "unpaid"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {inv.status === "paid" ? "Opłacona" : inv.status === "unpaid" ? "Nieopłacona" : inv.status || "—"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Lista kosztów fakturowni */}
            {expenses.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Koszty zlecenia ({expenses.length}):</span>
                {expenses.map((exp) => (
                  <div
                    key={exp._id}
                    className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100"
                  >
                    <div>
                      <p className="font-bold text-slate-800 text-xs truncate max-w-[180px]">
                        {exp.sellerName || exp.number || "Koszt"}
                      </p>
                      <p className="text-[10px] text-slate-400">{exp.issueDate || "—"}</p>
                    </div>
                    <p className="font-bold text-slate-900 text-xs">
                      {exp.grossAmount?.toLocaleString("pl-PL") ?? 0} {exp.currency || "PLN"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Sekcja 4: Zamówienia u dostawców */}
        <section id="sekcja-zamowienia" className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs space-y-3 scroll-mt-28">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <ShoppingCart className="size-4 text-amber-500" /> Zamówienia materiałów ({(order.serviceDeliveries ?? []).length})
          </h2>

          {(!order.serviceDeliveries || order.serviceDeliveries.length === 0) ? (
            <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
              Brak zarejestrowanych zamówień u dostawców
            </p>
          ) : (
            <div className="space-y-2 text-xs">
              {order.serviceDeliveries.map((delivery, idx) => {
                const supplierName = supplierMap[delivery.supplierId] || "Dostawca";
                const isDelivered = Boolean(delivery.receivedDate);
                const isConfirmed = Boolean(delivery.confirmedDate);
                const isOrdered = Boolean(delivery.orderDate);

                return (
                  <div
                    key={idx}
                    className="bg-amber-50/40 border border-amber-200/60 rounded-xl p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-extrabold text-slate-900 text-xs block">
                          {delivery.serviceName}
                        </span>
                        <p className="text-[11px] text-amber-900 font-semibold">{supplierName}</p>
                        {delivery.externalOrderNumber && (
                          <p className="text-[10px] text-slate-500 font-medium">
                            Nr CRM: <b>{delivery.externalOrderNumber}</b>
                          </p>
                        )}
                      </div>

                      <span
                        className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md border uppercase shrink-0 ${
                          isDelivered
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : isConfirmed
                            ? "bg-blue-100 text-blue-800 border-blue-200"
                            : isOrdered
                            ? "bg-amber-100 text-amber-800 border-amber-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {isDelivered
                          ? "Dostarczone"
                          : isConfirmed
                          ? "Potwierdzone"
                          : isOrdered
                          ? "Zamówione"
                          : "Szkic"}
                      </span>
                    </div>

                    {/* Daty dostawy */}
                    <div className="grid grid-cols-2 gap-1.5 bg-white/80 p-2 rounded-lg border border-amber-100 text-[10px]">
                      <div>
                        <span className="text-slate-400 block font-medium">Data zamówienia:</span>
                        <span className="font-bold text-slate-700">{formatDate(delivery.orderDate)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Planowana dostawa:</span>
                        <span className="font-bold text-amber-700">{formatDate(delivery.deliveryDate)}</span>
                      </div>
                    </div>

                    {delivery.notes && (
                      <p className="text-[11px] text-slate-600 bg-white/60 p-2 rounded-lg border border-amber-100">
                        <span className="font-bold text-slate-700 block">Uwagi:</span>
                        {delivery.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Sekcja 5: Montaż & Ekipa */}
        <section id="sekcja-montaz" className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs space-y-3 scroll-mt-28">
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

        {/* Sekcja 6: Reklamacje */}
        <section id="sekcja-reklamacje" className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs space-y-3 scroll-mt-28">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="size-4 text-red-500" /> Reklamacje ({complaints.length})
            </h2>
            <Link
              href={`/admin/klient/${order.clientId}/zlecenie/${order._id}?tab=reklamacja`}
              className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg active:scale-95 transition"
            >
              Zarządzaj
            </Link>
          </div>

          {complaints.length === 0 ? (
            <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
              Brak zgłoszeń reklamacyjnych dla tego zlecenia
            </p>
          ) : (
            <div className="space-y-2">
              {complaints.map((c) => (
                <div key={c._id} className="bg-red-50/50 p-3 rounded-xl border border-red-100 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-xs text-red-950 truncate">{c.title || "Reklamacja"}</span>
                    <span className="text-[9px] font-extrabold text-red-700 bg-red-100 px-2 py-0.5 rounded uppercase border border-red-200 shrink-0">
                      {c.status}
                    </span>
                  </div>
                  {c.description && <p className="text-xs text-slate-700 leading-snug">{c.description}</p>}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-red-100">
                    <span>Data zgłoszenia: {formatDate(c._creationTime)}</span>
                    {c.installationTeam && <span className="font-semibold text-slate-600">Ekipa: {c.installationTeam.name}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Sekcja 7: Dokumenty & Pliki Drive */}
        <section id="sekcja-dokumenty" className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs space-y-3 scroll-mt-28">
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

        {/* Sekcja 8: Notatki & Komentarze */}
        <section id="sekcja-notatki" className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs space-y-3 scroll-mt-28">
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
      </main>
    </div>
  );
}
