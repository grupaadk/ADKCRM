"use client";

import { use, useState, useMemo, Suspense } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Clock,
  ChevronRight,
  X,
  Check,
  Plus,
  Trash2,
  CheckSquare,
  Square,
} from "lucide-react";

const COMPLAINT_STATUS_LABELS: Record<string, string> = {
  nowa: "Nowa",
  w_toku: "W toku",
  rozwiazana: "Rozwiązana",
  zamknieta: "Zamknięta",
};

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

function daysInStatus(statusChangedAt?: number) {
  if (!statusChangedAt) return null;
  const days = Math.floor((Date.now() - statusChangedAt) / (1000 * 60 * 60 * 24));
  let color: "green" | "amber" | "red" = "green";
  let label = `${days} dny w statusie`;
  if (days === 0) label = "Dzisiaj zmieniono";
  else if (days === 1) label = "1 dzień w tym statusie";
  else if (days >= 7) {
    color = "red";
    label = `${days} dni w statusie! (Wymaga uwagi)`;
  } else if (days >= 3) {
    color = "amber";
    label = `${days} dni w tym statusie`;
  }
  return { days, label, color };
}

function getDocumentInfo(doc?: { enabled?: boolean; url?: string; generatedAt?: number; signatureStatus?: string; error?: string }) {
  if (!doc) {
    return { state: "none", bg: "bg-slate-50 border-slate-200/80", text: "text-slate-400 border-slate-200", label: "Brak", url: undefined };
  }
  if (doc.signatureStatus === "signed") {
    return { state: "signed", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800 font-extrabold border-emerald-200", label: "Podpisano", url: doc.url };
  }
  if (doc.url || doc.generatedAt) {
    return { state: "generated", bg: "bg-blue-50 border-blue-200", text: "text-blue-800 font-extrabold border-blue-200", label: "Wygenerowano", url: doc.url };
  }
  if (doc.error) {
    return { state: "error", bg: "bg-red-50 border-red-200", text: "text-red-700 font-extrabold border-red-200", label: "Błąd", url: undefined };
  }
  if (doc.enabled) {
    return { state: "pending", bg: "bg-amber-50 border-amber-200", text: "text-amber-800 font-extrabold border-amber-200", label: "W trakcie", url: undefined };
  }
  return { state: "none", bg: "bg-slate-50 border-slate-200/80", text: "text-slate-400 border-slate-200", label: "Brak", url: undefined };
}

function MobileOrderPageMain({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromTab = searchParams.get("from") || "panel";
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
  const createComplaint = useMutation(api.complaints.create);
  const updateComplaintStatus = useMutation(api.complaints.updateStatus);
  const updateComplaintDetails = useMutation(api.complaints.updateDetails);
  const addComplaintTodo = useMutation(api.complaints.addTodo);
  const toggleComplaintTodo = useMutation(api.complaints.toggleTodo);
  const deleteComplaint = useMutation(api.complaints.deleteComplaint);

  // Local State
  const [newNoteText, setNewNoteText] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedComplaintId, setSelectedComplaintId] = useState<Id<"complaints"> | null>(null);
  const [showNewComplaintModal, setShowNewComplaintModal] = useState(false);
  const [newComplaintDesc, setNewComplaintDesc] = useState("");
  const [newComplaintClientDesc, setNewComplaintClientDesc] = useState("");
  const [creatingComplaint, setCreatingComplaint] = useState(false);
  const [newTodoText, setNewTodoText] = useState("");
  const [confirmDeleteComplaintId, setConfirmDeleteComplaintId] = useState<string | null>(null);

  const selectedComplaint = useMemo(() => {
    if (!selectedComplaintId) return null;
    return complaints.find((c) => c._id === selectedComplaintId) ?? null;
  }, [complaints, selectedComplaintId]);

  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !client || !newComplaintDesc.trim() || creatingComplaint) return;
    setCreatingComplaint(true);
    try {
      await createComplaint({
        orderId: order._id,
        clientId: client._id,
        startDate: Date.now(),
        description: newComplaintDesc.trim(),
        clientDescription: newComplaintClientDesc.trim() || undefined,
        createdBy: "Aplikacja Mobilna",
      });
      setNewComplaintDesc("");
      setNewComplaintClientDesc("");
      setShowNewComplaintModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Błąd dodawania reklamacji");
    } finally {
      setCreatingComplaint(false);
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

  const daysInfo = useMemo(() => {
    return daysInStatus(order?.statusChangedAt);
  }, [order?.statusChangedAt]);

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
          onClick={() => router.push(`/app?tab=${fromTab}`)}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs"
        >
          Powrót
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
            onClick={() => router.push(`/app?tab=${fromTab}`)}
            className="flex items-center gap-1 text-slate-600 hover:text-slate-900 font-bold text-xs p-1 -ml-1 rounded-lg active:bg-slate-100"
          >
            <ArrowLeft className="size-4" />
            <span>{fromTab === "panel" ? "Panel" : fromTab === "tasks" ? "Zadania" : "Powrót"}</span>
          </button>
        </div>

        {/* Dynamic Title and Status */}
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-base font-extrabold text-slate-900 truncate">
              {order.name || "Zlecenie bez nazwy"}
            </h1>

            {statusStyle && (
              <span
                className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full border shadow-2xs cursor-pointer"
                onClick={() => setShowStatusModal(true)}
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
        {/* Quick Action Bar (Zadzwoń, Nawiguj) */}
        <div className="bg-white rounded-2xl p-3 border border-gray-200/90 shadow-xs">
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
        </div>

        {/* ── Przeprojektowany Moduł Statusu Zlecenia ── */}
        <section id="sekcja-status" className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs space-y-3 scroll-mt-28">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span
                className="size-3.5 rounded-full animate-pulse shrink-0 border border-white shadow-xs"
                style={{ backgroundColor: currentStatusDef?.color || "#4abbc3" }}
              />
              <div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                  Status Workflow
                </span>
                <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                  {currentStatusDef?.label}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowStatusModal(true)}
              className="flex items-center gap-1 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 px-3 py-1.5 rounded-xl active:scale-95 transition shrink-0"
            >
              <span>Zmień status</span>
              <ChevronRight className="size-4 text-slate-400" />
            </button>
          </div>

          {/* Czas w obecnym statusie */}
          {daysInfo && (
            <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
                <Clock className="size-3.5 text-slate-400" />
                <span>Czas w statusie:</span>
              </div>
              <span
                className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg border uppercase ${
                  daysInfo.color === "red"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : daysInfo.color === "amber"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}
              >
                {daysInfo.label}
              </span>
            </div>
          )}

        </section>

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

                    {((delivery.notesFeed && delivery.notesFeed.length > 0) || delivery.notes) && (
                      <div className="space-y-1.5 pt-1">
                        <span className="font-bold text-[10px] uppercase text-amber-900 tracking-wider block">
                          Uwagi do zamówienia ({delivery.notesFeed?.length ?? 1}):
                        </span>
                        {delivery.notesFeed && delivery.notesFeed.length > 0 ? (
                          delivery.notesFeed.map((nItem) => (
                            <div key={nItem.id} className="text-[11px] text-slate-700 bg-white/80 p-2 rounded-lg border border-amber-100/80 space-y-0.5">
                              <div className="flex items-center justify-between text-[9px] text-slate-400 font-semibold">
                                <span>{nItem.createdByName || "Użytkownik"}</span>
                                <span>
                                  {new Date(nItem.createdAt).toLocaleString("pl-PL", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              <p className="whitespace-pre-wrap leading-tight">{nItem.note}</p>
                            </div>
                          ))
                        ) : (
                          <div className="text-[11px] text-slate-700 bg-white/80 p-2 rounded-lg border border-amber-100/80">
                            <p className="whitespace-pre-wrap leading-tight">{delivery.notes}</p>
                          </div>
                        )}
                      </div>
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
            <button
              type="button"
              onClick={() => setShowNewComplaintModal(true)}
              className="flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-xl active:scale-95 transition"
            >
              <Plus className="size-3.5" />
              <span>Zgłoś reklamację</span>
            </button>
          </div>

          {complaints.length === 0 ? (
            <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
              Brak zgłoszeń reklamacyjnych dla tego zlecenia
            </p>
          ) : (
            <div className="space-y-2">
              {complaints.map((c) => (
                <div
                  key={c._id}
                  onClick={() => setSelectedComplaintId(c._id)}
                  className="bg-red-50/60 hover:bg-red-50 p-3 rounded-2xl border border-red-200/80 space-y-1.5 text-xs transition-all active:scale-[0.99] cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <ShieldAlert className="size-4 text-red-600 shrink-0" />
                      <span className="font-extrabold text-xs text-red-950 truncate">
                        {c.title || `Reklamacja #${c._id.slice(-4)}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] font-extrabold text-red-700 bg-white/80 px-2 py-0.5 rounded-lg uppercase border border-red-200">
                        {COMPLAINT_STATUS_LABELS[c.status] || c.status}
                      </span>
                      <ChevronRight className="size-4 text-red-400" />
                    </div>
                  </div>
                  {c.description && <p className="text-xs text-slate-700 leading-snug line-clamp-2">{c.description}</p>}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-red-100">
                    <span>Zgłoszono: {formatDate(c._creationTime)}</span>
                    {c.installationTeam && (
                      <span className="font-semibold text-slate-600">Ekipa: {c.installationTeam.name}</span>
                    )}
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
              const docEntry = (order.documents as Record<string, any> | undefined)?.[key];
              const info = getDocumentInfo(docEntry);

              return (
                <div
                  key={key}
                  className={`flex items-center justify-between p-3 rounded-xl border ${info.bg} transition-all`}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <span className="font-bold text-slate-800 text-xs block truncate">{DOC_NAMES[key]}</span>
                    {docEntry?.generatedAt && (
                      <span className="text-[10px] text-slate-500 block font-medium">
                        {formatDate(docEntry.generatedAt)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-md border uppercase ${info.text}`}>
                      {info.label}
                    </span>
                    {info.url && (
                      <a
                        href={info.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded-lg bg-white border border-gray-200 text-slate-600 hover:text-slate-900 active:scale-95 transition"
                        title="Otwórz plik"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </div>
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

      {/* ── Bottom Sheet Modalu Wyboru Statusu ── */}
      {showStatusModal && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setShowStatusModal(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] animate-in slide-in-from-bottom duration-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                  Wybierz nowy status
                </span>
                <h3 className="text-sm font-extrabold text-slate-900">Zmiana Statusu Zlecenia</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-3.5 overflow-y-auto space-y-2 flex-1">
              {statuses.filter((s) => s.key !== "archived").map((s) => {
                const isCurrent = s.key === order.status;
                const style = deriveStatusStyle(s.color);

                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={async () => {
                      await changeStatus({ orderId: order._id, newStatus: s.key as any });
                      setShowStatusModal(false);
                    }}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left active:scale-[0.99] ${
                      isCurrent
                        ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                        : "bg-slate-50 text-slate-800 border-gray-200/80 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="size-3.5 rounded-full shrink-0 border border-white/50"
                        style={{ backgroundColor: s.color }}
                      />
                      <div>
                        <span className="font-bold text-xs block">{s.label}</span>
                        {s.kind === "opportunity" && (
                          <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                            Szansa
                          </span>
                        )}
                      </div>
                    </div>

                    {isCurrent ? (
                      <span className="text-xs font-extrabold text-emerald-400 flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-xl">
                        <Check className="size-3.5" /> Obecny
                      </span>
                    ) : (
                      <ChevronRight className="size-4 text-slate-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Bottom Sheet Modalu Szczegółów Reklamacji ── */}
      {selectedComplaint && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
            onClick={() => {
              setSelectedComplaintId(null);
              setConfirmDeleteComplaintId(null);
            }}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] animate-in slide-in-from-bottom duration-200 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldAlert className="size-5 text-red-600 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Zgłoszenie Reklamacyjne
                  </span>
                  <h3 className="text-sm font-extrabold text-slate-900 truncate">
                    {selectedComplaint.title || `Reklamacja #${selectedComplaint._id.slice(-6)}`}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedComplaintId(null);
                  setConfirmDeleteComplaintId(null);
                }}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 shrink-0"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Status Selector */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Status reklamacji:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["nowa", "w_toku", "rozwiazana", "zamknieta"] as const).map((stKey) => {
                    const active = selectedComplaint.status === stKey;
                    return (
                      <button
                        key={stKey}
                        type="button"
                        onClick={() => updateComplaintStatus({ complaintId: selectedComplaint._id, status: stKey })}
                        className={`px-3 py-2 rounded-xl text-xs font-bold text-center border transition-all active:scale-95 ${
                          active
                            ? "bg-red-600 text-white border-red-600 shadow-2xs"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {COMPLAINT_STATUS_LABELS[stKey]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Opis usterki */}
              <div className="bg-red-50/50 p-3 rounded-2xl border border-red-100 space-y-1">
                <span className="text-[10px] font-bold text-red-800 uppercase block">Opis usterki / powód</span>
                <p className="text-slate-800 leading-relaxed font-medium">
                  {selectedComplaint.description || "Brak opisu usterki"}
                </p>
              </div>

              {/* Uwagi klienta */}
              {selectedComplaint.clientDescription && (
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Uwagi od klienta</span>
                  <p className="text-slate-700 leading-relaxed">{selectedComplaint.clientDescription}</p>
                </div>
              )}

              {/* Ekipa Montażowa */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Przypisana ekipa montażowa:</span>
                <select
                  value={selectedComplaint.installationTeamId ?? ""}
                  onChange={(e) => {
                    const teamVal = e.target.value ? (e.target.value as Id<"installationTeams">) : null;
                    updateComplaintDetails({
                      complaintId: selectedComplaint._id,
                      installationTeamId: teamVal,
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-red-500"
                >
                  <option value="">Brak przypisanej ekipy</option>
                  {teams.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Zadania do reklamacji (TODO) */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                  Zadania do wykonania ({(selectedComplaint.todos ?? []).length}):
                </span>

                <div className="space-y-1.5">
                  {(selectedComplaint.todos ?? []).map((td) => (
                    <div
                      key={td.id}
                      onClick={() => toggleComplaintTodo({ complaintId: selectedComplaint._id, todoId: td.id })}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 active:bg-slate-100 cursor-pointer"
                    >
                      {td.completed ? (
                        <CheckSquare className="size-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Square className="size-4 text-slate-400 shrink-0" />
                      )}
                      <span className={`text-xs ${td.completed ? "line-through text-slate-400 font-normal" : "text-slate-800 font-semibold"}`}>
                        {td.text}
                      </span>
                    </div>
                  ))}
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newTodoText.trim()) return;
                    await addComplaintTodo({ complaintId: selectedComplaint._id, text: newTodoText.trim() });
                    setNewTodoText("");
                  }}
                  className="flex items-center gap-1.5 pt-1"
                >
                  <input
                    type="text"
                    value={newTodoText}
                    onChange={(e) => setNewTodoText(e.target.value)}
                    placeholder="Dodaj zadanie..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-red-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs shrink-0 active:scale-95 transition"
                  >
                    Dodaj
                  </button>
                </form>
              </div>

              {/* Link do Google Drive */}
              {selectedComplaint.complaintFolderUrl && (
                <div className="pt-2 border-t border-slate-100">
                  <a
                    href={selectedComplaint.complaintFolderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl py-2.5 font-bold text-xs active:scale-95 transition"
                  >
                    <FolderOpen className="size-4" />
                    <span>Otwórz folder reklamacji w Google Drive</span>
                  </a>
                </div>
              )}

              {/* Usuwanie reklamacji */}
              <div className="pt-3 border-t border-slate-100">
                {confirmDeleteComplaintId === selectedComplaint._id ? (
                  <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-center space-y-2">
                    <p className="text-xs font-bold text-red-800">Czy na pewno usunąć tę reklamację?</p>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteComplaintId(null)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-red-200 text-slate-700 text-xs font-bold"
                      >
                        Anuluj
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteComplaint({ complaintId: selectedComplaint._id });
                          setSelectedComplaintId(null);
                          setConfirmDeleteComplaintId(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold shadow-xs"
                      >
                        Usuń
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteComplaintId(selectedComplaint._id)}
                    className="w-full flex items-center justify-center gap-1.5 text-red-600 bg-red-50 hover:bg-red-100 border border-red-200/80 rounded-xl py-2 font-bold text-xs active:scale-95 transition"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Usuń reklamację</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Bottom Sheet Dodawania Nowej Reklamacji ── */}
      {showNewComplaintModal && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setShowNewComplaintModal(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] animate-in slide-in-from-bottom duration-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-5 text-red-600" />
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Nowe zgłoszenie
                  </span>
                  <h3 className="text-sm font-extrabold text-slate-900">Zgłoś reklamację</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNewComplaintModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreateComplaint} className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase block">Opis usterki / zgłoszenia *</label>
                <textarea
                  rows={3}
                  required
                  value={newComplaintDesc}
                  onChange={(e) => setNewComplaintDesc(e.target.value)}
                  placeholder="Opisz usterkę lub przyczynę reklamacji..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:border-red-500 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase block">Uwagi od klienta (opcjonalnie)</label>
                <textarea
                  rows={2}
                  value={newComplaintClientDesc}
                  onChange={(e) => setNewComplaintClientDesc(e.target.value)}
                  placeholder="Dodatkowe informacje przekazane przez klienta..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:border-red-500 font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={creatingComplaint || !newComplaintDesc.trim()}
                className="w-full py-3 rounded-2xl bg-red-600 text-white font-extrabold text-xs shadow-md active:scale-98 transition disabled:opacity-50 mt-2"
              >
                {creatingComplaint ? "Zgłaszanie..." : "Zapisz reklamację"}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

export default function MobileOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="h-full w-full bg-slate-50 flex items-center justify-center p-4">
          <div className="animate-spin size-8 border-4 border-[#4abbc3] border-t-transparent rounded-full" />
        </div>
      }
    >
      <MobileOrderPageMain params={params} />
    </Suspense>
  );
}
