"use client";

import type { ReactNode } from "react";
import { use, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import InlineEdit from "../../InlineEdit";
import DocumentCheckboxes from "../../DocumentCheckboxes";
import OrderLineItems from "../../OrderLineItems";
import EventTimeline from "../../EventTimeline";
import { useStatusLabels } from "@/components/StatusLabelsContext";
import ComplaintTab from "./ComplaintTab";
import DocumentProgressTiles from "../../DocumentProgressTiles";
import InvestmentLocation from "../../InvestmentLocation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";

const KIND_LABELS: Record<string, string> = {
  vat: "Faktura VAT",
  advance: "Faktura zaliczkowa",
  final: "Faktura końcowa",
  estimate: "Wycena",
  proforma: "Proforma",
  correction: "Korekta",
};

const KIND_VARIANTS: Record<string, string> = {
  vat: "default",
  advance: "purple",
  final: "teal",
  estimate: "amber",
  proforma: "neutral",
  correction: "orange",
};

const STATUS_LABELS: Record<string, string> = {
  issued: "Wystawiona",
  sent: "Wysłana",
  paid: "Zapłacona",
  partially_paid: "Częściowo zapłacona",
  rejected: "Odrzucona",
  draft: "Szkic",
};

const STATUS_VARIANTS: Record<string, string> = {
  issued: "neutral",
  sent: "default",
  paid: "success",
  partially_paid: "warning",
  rejected: "error",
  draft: "amber",
};

type CachedInvoice = {
  _id: Id<"fakturowniaInvoicesCache">;
  remoteId: string;
  number?: string;
  kind: string;
  status?: string;
  buyerName?: string;
  issueDate?: string;
  grossAmount?: number;
  currency?: string;
  orderId?: Id<"orders">;
};

const STATUS_ORDER = [
  "measurement", "contract",
  "production", "installation", "complaint", "completed",
] as const;

const STATUS_TRANSITIONS: Record<string, string[]> = {
  lead: ["inquiry", "measurement"],
  inquiry: ["measurement", "offer"],
  measurement: ["offer", "contract"],
  offer: ["contract", "lead"],
  contract: ["production"],
  production: ["installation"],
  installation: ["completed"],
  completed: ["complaint"],
  warranty: [],
};

const ORDER_VISIBLE_STATUSES = new Set([
  "measurement", "offer", "contract", "production",
  "installation", "completed", "complaint",
]);

const COLOR_FIELDS: Array<{ key: string; label: string }> = [
  { key: "windowColor", label: "Okna" },
  { key: "doorColor", label: "Drzwi" },
  { key: "gateColor", label: "Brama" },
  { key: "terraceColor", label: "Zabudowa tarasu" },
  { key: "constructionColor", label: "Konstrukcja" },
];

type Tab = "zlecenie" | "wycena" | "dokumenty" | "reklamacja";

function getProjectFileLinks(projectFiles: string | undefined) {
  if (!projectFiles) return [];
  return projectFiles.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
}

function getFileName(url: string, index: number) {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split("/").filter(Boolean).at(-1) || `Zalacznik ${index + 1}`;
  } catch {
    return `Zalacznik ${index + 1}`;
  }
}

function SectionCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{title}</h2>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function ColorCard({ label, values }: { label: string; values: string[] }) {
  if (!values?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200">{v}</span>
        ))}
      </div>
    </div>
  );
}

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string; orderId: string }>;
}) {
  const { id, orderId } = use(params);
  const clientId = id as Id<"clients">;
  const orderIdTyped = orderId as Id<"orders">;
  const router = useRouter();

  const statusLabels = useStatusLabels();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) ?? "zlecenie";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [sendingAddress, setSendingAddress] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState("");

  const client = useQuery(api.clients.getById, { clientId });
  const order = useQuery(api.orders.getById, { orderId: orderIdTyped });
  const events = useQuery(api.events.listByOrder, { orderId: orderIdTyped });
  const assignedInvoices = useQuery(api.fakturownia.listCachedInvoicesByOrder, { orderId: orderIdTyped });
  const allInvoices = useQuery(api.fakturownia.listCachedInvoices) as CachedInvoice[] | undefined;
  const fakturowniaConfig = useQuery(api.fakturownia.getConfig);
  const existingComplaint = useQuery(api.complaints.getByOrderId, { orderId: orderIdTyped });
  const changeStatus = useMutation(api.orders.changeStatus);
  const assignInvoice = useMutation(api.fakturownia.assignInvoiceToOrder);
  const unassignInvoice = useMutation(api.fakturownia.unassignInvoiceFromOrder);
  const createOrderFolder = useAction(api.googleDrive.createOrderFolder);
  const deleteOrder = useAction(api.orders.deleteOrder);
  const sendOrderAddressSms = useAction(api.sms.sendOrderAddressSms);

  if (client === undefined || order === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-slate-400">Ladowanie...</div>
      </div>
    );
  }

  if (!client || !order) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <div className="text-sm text-slate-500">Nie znaleziono.</div>
        <Link href={`/admin/klient/${id}`} className="text-sm text-blue-600 hover:underline">
          Wroc do klienta
        </Link>
      </div>
    );
  }

  const allowedTransitions = STATUS_TRANSITIONS[order.status] ?? [];
  const statusLabel = statusLabels[order.status] ?? order.status;
  const currentStatusIndex = STATUS_ORDER.indexOf(order.status as (typeof STATUS_ORDER)[number]);

  // Statusy, które zostały osiągnięte przez ruch karty w Trello
  const trelloVisitedStatuses = new Set(
    (events ?? [])
      .filter(
        (e) =>
          e.type === "status_changed" &&
          (e.details?.triggeredBy === "trello" ||
            e.details?.triggeredBy === "trello_card_move"),
      )
      .map((e) => e.details?.to as string),
  );
  const showOrderDetails = ORDER_VISIBLE_STATUSES.has(order.status);
  const projectFileLinks = getProjectFileLinks(order.projectFiles);

  async function handleStatusChange(newStatus: string) {
    try {
      await changeStatus({
        orderId: orderIdTyped,
        newStatus: newStatus as "lead" | "inquiry" | "measurement" | "offer" | "contract" | "production" | "installation" | "completed" | "complaint",
      });
    } catch (error) {
      console.error("Status change failed:", error);
    }
  }

  async function handleCreateFolder() {
    try {
      await createOrderFolder({ orderId: orderIdTyped });
    } catch (error) {
      console.error("Folder creation failed:", error);
    }
  }

  async function handleSendAddress() {
    setSendingAddress(true);
    try {
      await sendOrderAddressSms({ orderId: orderIdTyped });
    } catch (error) {
      console.error("Błąd wysyłki SMS z adresem zlecenia:", error);
    } finally {
      setSendingAddress(false);
    }
  }

  async function handleDelete() {
    setDeleteLoading(true);
    try {
      await deleteOrder({ orderId: orderIdTyped });
      router.push(`/admin/klient/${id}`);
    } catch (error) {
      console.error("Order deletion failed:", error);
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  }

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "zlecenie", label: "Zlecenie" },
    { key: "wycena", label: "Wycena" },
    { key: "dokumenty", label: "Dokumenty" },
    ...(order.status === "complaint" || existingComplaint ? [{ key: "reklamacja" as Tab, label: "Reklamacja" }] : []),
  ];

  const createdDate = new Date(order._creationTime).toLocaleDateString("pl-PL", {
    day: "2-digit", month: "2-digit", year: "numeric"
  });
  const orderNumber = order.name ?? `Zlecenie z ${createdDate}`;
  const completedStatusIndex = STATUS_ORDER.indexOf("completed");
  const hasReachedCompleted = currentStatusIndex >= completedStatusIndex;
  const completedEvent = (events ?? []).find(
    (e) => e.type === "status_changed" && e.details?.to === "completed"
  );
  const completedDate = completedEvent
    ? new Date(completedEvent._creationTime).toLocaleString("pl-PL", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
      })
    : null;

  const measurementStatusIndex = STATUS_ORDER.indexOf("measurement");
  const hasReachedMeasurement = currentStatusIndex >= measurementStatusIndex;
  const measurementEvent = (events ?? []).find(
    (e) => e.type === "status_changed" && e.details?.to === "measurement"
  );
  const measurementDate = measurementEvent
    ? new Date(measurementEvent._creationTime).toLocaleString("pl-PL", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
      })
    : null;

  const warrantyStatusIndex = STATUS_ORDER.indexOf("complaint");
  const hasReachedWarranty = currentStatusIndex >= warrantyStatusIndex;
  const warrantyEvent = (events ?? []).find(
    (e) => e.type === "status_changed" && e.details?.to === "complaint"
  );
  const warrantyDate = warrantyEvent
    ? new Date(warrantyEvent._creationTime).toLocaleString("pl-PL", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
      })
    : null;
  const projectStartTs = measurementEvent?._creationTime ?? null;
  const projectEndTs = completedEvent?._creationTime ?? null;
  const projectEndDate = completedDate ?? null;
  const projectIsOngoing = hasReachedMeasurement && !hasReachedCompleted && !hasReachedWarranty;
  const projectDurationDays = projectStartTs
    ? Math.round(((projectEndTs ?? Date.now()) - projectStartTs) / (1000 * 60 * 60 * 24))
    : null;

  const servicesSummary = order.services?.slice(0, 3).join(", ") ?? "";
  const fkInvoices = order.fakturownia?.invoices ?? [];
  const fkSummary =
    fkInvoices.length > 0
      ? fkInvoices
          .map((i) =>
            i.kind === "advance"
              ? `zaliczka${i.number ? ` ${i.number}` : ""}`
              : `końcowa${i.number ? ` ${i.number}` : ""}`,
          )
          .join(", ")
      : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        {/* Top bar: navigation + actions */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Link href="/admin" className="hover:text-slate-600 transition-colors">Klienci</Link>
            <svg className="h-3 w-3 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" /></svg>
            <Link
              href={`/admin/klient/${id}`}
              className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 font-semibold text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 border border-transparent hover:border-blue-200"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
              {client.firstName} {client.lastName}
            </Link>
            <svg className="h-3 w-3 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" /></svg>
            <span className="font-medium text-slate-600">{orderNumber}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleSendAddress()}
              disabled={sendingAddress}
              className="flex items-center gap-1.5 rounded-lg border border-transparent bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
              {sendingAddress ? "Wysyłanie..." : "Wyślij adres"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 hover:border-red-300"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
              Usuń Zlecenie
            </button>
          </div>
        </div>

        {/* Main heading */}
        <div className="px-6 pt-5 pb-4">
          <h1 className="text-xl font-black tracking-tight text-slate-900">{orderNumber}</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            {client.city ? `${client.city}` : ""}
            {servicesSummary ? `${client.city ? " • " : ""}${servicesSummary}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <DocumentProgressTiles documents={order.documents} />
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" /></svg>
              Dodano: {createdDate}
            </span>
            {fkSummary && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                Fakturownia: {fkSummary}
              </span>
            )}
            {assignedInvoices && assignedInvoices.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                {assignedInvoices.length === 1 ? "1 faktura" : `${assignedInvoices.length} faktury/faktur`}
              </span>
            )}
          </div>
        </div>

        {/* Status timeline */}
        <div className={`border-t px-6 py-5 ${existingComplaint ? "border-orange-200 bg-orange-50/60" : "border-slate-100 bg-slate-50/60"}`}>
          {existingComplaint && (
            <div className="mb-4 flex items-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-[11px] font-semibold text-orange-700 ring-1 ring-orange-300">
                <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                Była reklamacja
              </span>
            </div>
          )}
          <div className="flex w-full items-start">
            {STATUS_ORDER.map((status, index) => {
              const isPast = index < currentStatusIndex;
              const isCurrent = index === currentStatusIndex;
              const isLast = index === STATUS_ORDER.length - 1;
              const wasOnTrello = trelloVisitedStatuses.has(status);
              const isOrange = isPast && !wasOnTrello;
              return (
                <div key={status} className={`flex items-center ${!isLast ? "flex-1 min-w-0" : ""}`}>
                  <div className="flex flex-col items-center">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      isCurrent && status === "completed"
                        ? "bg-emerald-500 text-white ring-4 ring-emerald-100 shadow-md"
                        : isCurrent
                        ? "bg-blue-600 text-white ring-4 ring-blue-100 shadow-md"
                        : isOrange
                        ? "bg-orange-400 text-white"
                        : isPast
                        ? "bg-emerald-500 text-white"
                        : "bg-white text-slate-400 ring-1 ring-slate-200"
                    }`}>
                      {isPast || (isCurrent && status === "completed") ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </div>
                    <span className={`mt-1.5 w-14 text-[10px] font-semibold leading-tight text-center ${
                      isCurrent && status === "completed" ? "text-emerald-600" : isCurrent ? "text-blue-700" : isOrange ? "text-orange-500" : isPast ? "text-emerald-600" : "text-slate-400"
                    }`}>
                      {statusLabels[status] ?? status}
                    </span>
                  </div>
                  {!isLast && (
                    <div className={`mb-5 h-0.5 flex-1 min-w-2 transition-colors ${
                      isPast ? "bg-emerald-400" : "bg-slate-200"
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-slate-100">
          {tabs.map((tab) => {
            const isComplaintTab = tab.key === "reklamacja";
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 px-6 py-3 text-sm font-semibold transition-colors sm:flex-none ${
                  activeTab === tab.key
                    ? isComplaintTab
                      ? "border-b-2 border-orange-500 text-orange-600"
                      : "border-b-2 border-blue-600 text-blue-600"
                    : isComplaintTab
                    ? "text-orange-500 hover:text-orange-600"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab: Zlecenie */}
      {activeTab === "zlecenie" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <SectionCard title="Linki">
              <div className="space-y-3">
                {order.folderUrl ? (
                  <a href={order.folderUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition-colors hover:bg-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm">
                        <svg className="h-4 w-4 text-slate-600" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-slate-700">Google Drive</span>
                    </div>
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                    <p className="mb-3 text-sm text-slate-500">Folder zlecenia nie zostal jeszcze utworzony.</p>
                    <button onClick={handleCreateFolder}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                      Utworz folder
                    </button>
                  </div>
                )}

                {order.trelloCardUrl && (
                  <a href={order.trelloCardUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition-colors hover:bg-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm">
                        <svg className="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M21 0H3C1.343 0 0 1.343 0 3v18c0 1.656 1.343 3 3 3h18c1.656 0 3-1.344 3-3V3c0-1.657-1.344-3-3-3zM10.44 18.18c0 .795-.645 1.44-1.44 1.44H4.56c-.795 0-1.44-.645-1.44-1.44V4.56c0-.795.645-1.44 1.44-1.44H9c.795 0 1.44.645 1.44 1.44v13.62zm10.44-6c0 .794-.645 1.44-1.44 1.44H15c-.795 0-1.44-.646-1.44-1.44V4.56c0-.795.645-1.44 1.44-1.44h4.44c.795 0 1.44.645 1.44 1.44v7.62z" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-slate-700">Karta Trello</span>
                    </div>
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                )}
              </div>
            </SectionCard>
          </div>

          <div className="lg:col-span-3">
            <SectionCard title="Szczegoly zlecenia">
              <div className="space-y-6">
                <InvestmentLocation
                  orderId={orderIdTyped}
                  investmentStreet={order.investmentStreet}
                  investmentBuildingNumber={order.investmentBuildingNumber}
                  investmentApartmentNumber={order.investmentApartmentNumber}
                  investmentPostalCode={order.investmentPostalCode}
                  investmentCity={order.investmentCity}
                />

              {showOrderDetails ? (
                <div className="space-y-6">
                  {order.services && order.services.length > 0 && (
                    <div>
                      <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Uslugi</div>
                      <div className="flex flex-wrap gap-2">
                        {order.services.map((service) => (
                          <span key={service} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">{service}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {COLOR_FIELDS.some(({ key }) => (order[key as keyof typeof order] as string[] | undefined)?.length) && (
                    <div>
                      <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Kolory</div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {COLOR_FIELDS.map(({ key, label }) => (
                          <ColorCard key={key} label={label} values={(order[key as keyof typeof order] as string[] | undefined) ?? []} />
                        ))}
                      </div>
                    </div>
                  )}

                  {order.sunProtectionType && order.sunProtectionType.length > 0 && (
                    <div>
                      <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">System przeciwsloneczny</div>
                      <div className="flex flex-wrap gap-2">
                        {order.sunProtectionType.map((type) => (
                          <span key={type} className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">{type}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {(order.driveProjectFiles?.length ?? projectFileLinks.length) > 0 && (
                    <div>
                      <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Pliki projektu</div>
                      <div className="space-y-2">
                        {order.driveProjectFiles?.length ? (
                          order.driveProjectFiles.map((file) => (
                            <a key={file.fileId} href={file.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition-colors hover:bg-slate-100">
                              <svg className="h-4 w-4 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                              </svg>
                              <span className="text-sm font-medium text-slate-700">{file.name}</span>
                              <svg className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                              </svg>
                            </a>
                          ))
                        ) : (
                          projectFileLinks.map((fileUrl, index) => (
                            <a key={`${fileUrl}-${index}`} href={`${process.env.NEXT_PUBLIC_CONVEX_URL}/api/jotform/file?url=${encodeURIComponent(fileUrl)}`} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition-colors hover:bg-slate-100">
                              <svg className="h-4 w-4 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                              </svg>
                              <span className="text-sm font-medium text-slate-700">{getFileName(fileUrl, index)}</span>
                              <svg className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                              </svg>
                            </a>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {order.comment && (
                    <div>
                      <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Komentarz</div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="whitespace-pre-wrap text-sm text-slate-700">{order.comment}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                    <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-500">
                    Szczegoly zlecenia sa dostepne od statusu <strong className="text-slate-700">Pomiar</strong>.
                  </p>
                </div>
              )}
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {/* Tab: Wycena */}
      {activeTab === "wycena" && (
        <div className="space-y-6">
          <SectionCard title="Pozycje zamówienia">
            <OrderLineItems orderId={orderIdTyped} fakturownia={order.fakturownia} />
          </SectionCard>

        </div>
      )}

      {/* Tab: Dokumenty */}
      {activeTab === "dokumenty" && (
        <div className="space-y-6">
          <SectionCard
            title="Faktury z Fakturowni"
            action={
              <button
                onClick={() => setShowInvoiceModal(true)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Przypisz fakturę
              </button>
            }
          >
            {assignedInvoices && assignedInvoices.length > 0 ? (
              <TableRoot>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Numer</TableHeaderCell>
                      <TableHeaderCell>Rodzaj</TableHeaderCell>
                      <TableHeaderCell>Status</TableHeaderCell>
                      <TableHeaderCell>Nabywca</TableHeaderCell>
                      <TableHeaderCell>Data wystawienia</TableHeaderCell>
                      <TableHeaderCell className="text-right">Kwota brutto</TableHeaderCell>
                      <TableHeaderCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {assignedInvoices.map((inv) => {
                      const invUrl = fakturowniaConfig?.subdomain
                        ? `https://${fakturowniaConfig.subdomain}.fakturownia.pl/invoices/${inv.remoteId}`
                        : null;
                      return (
                        <TableRow key={inv._id} className="hover:bg-gray-50 transition-colors">
                          <TableCell className="whitespace-nowrap font-mono text-sm text-gray-900">
                            <div className="flex items-center gap-1.5">
                              {inv.number ?? <span className="text-gray-400">#{inv.remoteId}</span>}
                              {invUrl && (
                                <a href={invUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-500 transition-colors">
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                                </a>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={(KIND_VARIANTS[inv.kind] ?? "neutral") as Parameters<typeof Badge>[0]["variant"]}>
                              {KIND_LABELS[inv.kind] ?? inv.kind}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {inv.status ? (
                              <Badge variant={(STATUS_VARIANTS[inv.status] ?? "neutral") as Parameters<typeof Badge>[0]["variant"]}>
                                {STATUS_LABELS[inv.status] ?? inv.status}
                              </Badge>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-normal min-w-[160px] max-w-[260px] text-sm text-gray-900">
                            {inv.buyerName ?? <span className="text-gray-400">—</span>}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-gray-600">
                            {inv.issueDate
                              ? new Date(inv.issueDate).toLocaleDateString("pl-PL")
                              : <span className="text-gray-400">—</span>}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums text-sm font-semibold text-gray-900">
                            {inv.grossAmount != null
                              ? `${inv.grossAmount.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${inv.currency ?? "PLN"}`
                              : <span className="text-gray-400">—</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            <button
                              onClick={() => unassignInvoice({ invoiceId: inv._id })}
                              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 ml-auto"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                              Odepnij
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableRoot>
            ) : (
              <p className="text-sm italic text-slate-400">Brak przypisanych faktur.</p>
            )}
          </SectionCard>
          <DocumentCheckboxes orderId={orderIdTyped} documents={order.documents} />
        </div>
      )}

      {/* Tab: Reklamacja */}
      {activeTab === "reklamacja" && (order.status === "complaint" || existingComplaint) && (
        <ComplaintTab
          orderId={orderIdTyped}
          clientId={clientId}
          complaintStartDate={warrantyEvent?._creationTime ?? null}
        />
      )}

      {/* Invoice assignment modal */}
      {showInvoiceModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => { setShowInvoiceModal(false); setInvoiceSearch(""); }}
        >
          <div
            className="relative flex h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Przypisz faktury do zlecenia</h2>
                <p className="mt-0.5 text-xs text-slate-500">{orderNumber}</p>
              </div>
              <button
                onClick={() => { setShowInvoiceModal(false); setInvoiceSearch(""); }}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="border-b border-gray-100 px-5 py-3">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                <input
                  type="text"
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  placeholder="Szukaj po numerze lub nabywcy…"
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3">
              {allInvoices === undefined ? (
                <div className="py-8 text-center text-sm text-gray-400">Ładowanie…</div>
              ) : (
                <div className="space-y-1">
                  {allInvoices
                    .filter((inv) => {
                      const q = invoiceSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (inv.number ?? "").toLowerCase().includes(q) || (inv.buyerName ?? "").toLowerCase().includes(q);
                    })
                    .sort((a, b) => {
                      const rank = (inv: CachedInvoice) =>
                        inv.orderId === orderIdTyped ? 0 : !inv.orderId ? 1 : 2;
                      return rank(a) - rank(b);
                    })
                    .map((inv) => {
                      const isAssignedHere = inv.orderId === orderIdTyped;
                      const isAssignedElsewhere = !!inv.orderId && inv.orderId !== orderIdTyped;
                      const kindLabel =
                        inv.kind === "vat" ? "Faktura VAT" :
                        inv.kind === "advance" ? "Faktura zaliczkowa" :
                        inv.kind === "final" ? "Faktura końcowa" :
                        inv.kind === "proforma" ? "Proforma" :
                        inv.kind === "correction" ? "Korekta" :
                        inv.kind === "estimate" ? "Wycena" : inv.kind;
                      return (
                        <div
                          key={inv._id}
                          className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${
                            isAssignedHere
                              ? "bg-blue-50 ring-1 ring-blue-200"
                              : isAssignedElsewhere
                              ? "opacity-50"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium text-slate-900">
                                {inv.number ?? `#${inv.remoteId}`}
                              </span>
                              <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                                {kindLabel}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                              {inv.buyerName && <span className="truncate">{inv.buyerName}</span>}
                              {inv.grossAmount != null && (
                                <span className="shrink-0 tabular-nums">
                                  {inv.grossAmount.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} {inv.currency ?? "PLN"}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="ml-3 shrink-0">
                            {isAssignedHere ? (
                              <button
                                onClick={() => unassignInvoice({ invoiceId: inv._id })}
                                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                Odepnij
                              </button>
                            ) : (
                              <button
                                onClick={() => assignInvoice({ invoiceId: inv._id, orderId: orderIdTyped })}
                                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                                Przypisz
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold text-slate-900">Usunąć zlecenie?</h2>
            <p className="mb-6 text-sm text-slate-500">
              Zostaną usunięte wszystkie dane zlecenia, dokumenty i folder Google Drive.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                Anuluj
              </button>
              <button onClick={handleDelete} disabled={deleteLoading}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {deleteLoading ? "Usuwanie..." : "Tak, usuń"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
