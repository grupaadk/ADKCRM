"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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
import {
  RefreshCw,
  ExternalLink,
  Link2,
  Link2Off,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  AlertTriangle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type CachedInvoice = {
  _id: Id<"fakturowniaInvoicesCache">;
  _creationTime: number;
  remoteId: string;
  number?: string;
  kind: string;
  status?: string;
  buyerName?: string;
  issueDate?: string;
  sellDate?: string;
  paymentTo?: string;
  grossAmount?: number;
  netAmount?: number;
  currency?: string;
  oid?: string;
  orderId?: Id<"orders">;
  syncedAt: number;
};

type OrderItem = {
  _id: string;
  clientId: string;
  name?: string;
  status: string;
  client: { firstName: string; lastName: string; city?: string } | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const KIND_LABELS: Record<string, string> = {
  vat: "Faktura VAT",
  advance: "Faktura zaliczkowa",
  final: "Faktura końcowa",
  estimate: "Wycena",
  proforma: "Proforma",
  correction: "Korekta",
};

const STATUS_LABELS: Record<string, string> = {
  issued: "Wystawiona",
  sent: "Wysłana",
  paid: "Zapłacona",
  partially_paid: "Częściowo zapłacona",
  rejected: "Odrzucona",
  draft: "Szkic",
};

type StatusVariant = "default" | "neutral" | "success" | "error" | "warning" | "purple" | "amber" | "orange" | "violet" | "teal" | "cyan";

const STATUS_VARIANTS: Record<string, StatusVariant> = {
  issued: "neutral",
  sent: "default",
  paid: "success",
  partially_paid: "warning",
  rejected: "error",
  draft: "amber",
};

const KIND_VARIANTS: Record<string, StatusVariant> = {
  vat: "default",
  advance: "purple",
  final: "teal",
  estimate: "amber",
  proforma: "neutral",
  correction: "orange",
};

type SortField = "number" | "kind" | "status" | "buyerName" | "issueDate" | "paymentTo" | "grossAmount";
type SortDir = "asc" | "desc";
type PaymentFilter = "" | "thisWeek" | "nextWeek" | "overdue";

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field) return <ChevronsUpDown className="ml-1 inline size-3.5 text-gray-300" />;
  return sortDir === "asc"
    ? <ChevronUp className="ml-1 inline size-3.5 text-gray-700" />
    : <ChevronDown className="ml-1 inline size-3.5 text-gray-700" />;
}

function SkeletonRow() {
  return (
    <TableRow className="animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <TableCell key={i}><div className="h-4 rounded bg-gray-200" /></TableCell>
      ))}
    </TableRow>
  );
}

function relativeTime(ms: number): string {
  const secs = Math.floor((Date.now() - ms) / 1000);
  if (secs < 60) return "przed chwilą";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min. temu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} godz. temu`;
  return new Date(ms).toLocaleString("pl-PL");
}

// ─── Assignment Modal ─────────────────────────────────────────────────────────

function AssignModal({
  invoice,
  orders,
  onAssign,
  onUnassign,
  onClose,
}: {
  invoice: CachedInvoice;
  orders: OrderItem[];
  onAssign: (orderId: Id<"orders">) => void;
  onUnassign: () => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders.slice(0, 30);
    return orders.filter((o) => {
      const clientName = o.client ? `${o.client.lastName} ${o.client.firstName}`.toLowerCase() : "";
      const orderName = (o.name ?? "").toLowerCase();
      return clientName.includes(q) || orderName.includes(q);
    }).slice(0, 30);
  }, [orders, search]);

  const currentOrder = invoice.orderId ? orders.find((o) => o._id === invoice.orderId) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl ring-1 ring-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Przypisz do zlecenia</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {invoice.number ?? invoice.remoteId} — {invoice.buyerName ?? "—"}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X className="size-5" />
          </button>
        </div>

        {/* Current assignment */}
        {currentOrder && (
          <div className="border-b border-gray-100 px-5 py-3">
            <p className="mb-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Aktualne zlecenie</p>
            <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2.5 ring-1 ring-blue-200">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {currentOrder.client
                    ? `${currentOrder.client.lastName} ${currentOrder.client.firstName}`
                    : "—"}
                </p>
                {currentOrder.name && (
                  <p className="text-xs text-gray-500">{currentOrder.name}</p>
                )}
              </div>
              <button
                onClick={onUnassign}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                <Link2Off className="size-3.5" />
                Usuń przypisanie
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="px-5 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj po nazwie klienta lub numerze zlecenia…"
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Order list */}
        <div className="max-h-72 overflow-y-auto px-5 pb-4">
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400">Brak wyników</p>
          )}
          <div className="space-y-1">
            {filtered.map((order) => {
              const isSelected = order._id === invoice.orderId;
              return (
                <button
                  key={order._id}
                  onClick={() => onAssign(order._id as Id<"orders">)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors ${
                    isSelected
                      ? "bg-blue-50 ring-1 ring-blue-200"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {order.client
                        ? `${order.client.lastName} ${order.client.firstName}`
                        : "—"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {order.name && (
                        <span className="text-xs text-gray-500 font-mono">{order.name}</span>
                      )}
                      {order.client?.city && (
                        <span className="text-xs text-gray-400">{order.client.city}</span>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <span className="text-xs font-medium text-blue-600">Przypisane</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const STALE_MS = 5 * 60 * 1000; // 5 minutes

export default function FakturaList() {
  const invoices = useQuery(api.fakturownia.listCachedInvoices) as CachedInvoice[] | undefined;
  const orders = useQuery(api.orders.list, {}) as OrderItem[] | undefined;
  const config = useQuery(api.fakturownia.getConfig);

  const syncAction = useAction(api.fakturownia.syncInvoicesFromFakturownia);
  const assignMutation = useMutation(api.fakturownia.assignInvoiceToOrder);
  const unassignMutation = useMutation(api.fakturownia.unassignInvoiceFromOrder);

  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ count: number; pages: number } | null>(null);
  const [assigningInvoice, setAssigningInvoice] = useState<CachedInvoice | null>(null);
  const [kindFilter, setKindFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("");
  const [sortField, setSortField] = useState<SortField>("issueDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const autoSyncDone = useRef(false);

  const lastSyncAt = useMemo(() => {
    if (!invoices || invoices.length === 0) return 0;
    return Math.max(...invoices.map((i) => i.syncedAt));
  }, [invoices]);

  const isStale = Date.now() - lastSyncAt > STALE_MS;

  // Auto-sync on first load if empty or stale
  useEffect(() => {
    if (autoSyncDone.current) return;
    if (invoices === undefined) return; // still loading
    if (!isStale && invoices.length > 0) return;
    autoSyncDone.current = true;
    handleSync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices]);

  async function handleSync() {
    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const result = await syncAction({});
      setSyncResult(result);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Błąd synchronizacji");
    } finally {
      setSyncing(false);
    }
  }

  async function handleAssign(orderId: Id<"orders">) {
    if (!assigningInvoice) return;
    await assignMutation({ invoiceId: assigningInvoice._id, orderId });
    setAssigningInvoice(null);
  }

  async function handleUnassign() {
    if (!assigningInvoice) return;
    await unassignMutation({ invoiceId: assigningInvoice._id });
    setAssigningInvoice(null);
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  // Build kind counts
  const kindCounts = useMemo(() => {
    if (!invoices) return {} as Record<string, number>;
    const counts: Record<string, number> = {};
    for (const inv of invoices) {
      counts[inv.kind] = (counts[inv.kind] ?? 0) + 1;
    }
    return counts;
  }, [invoices]);

  const allKinds = useMemo(() => Object.keys(kindCounts).sort(), [kindCounts]);

  // Filter + sort
  const displayed = useMemo(() => {
    if (!invoices) return undefined;
    let list = invoices;
    if (kindFilter) list = list.filter((i) => i.kind === kindFilter);
    if (paymentFilter === "overdue") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      list = list.filter((i) => {
        if (!i.paymentTo || i.status === "paid") return false;
        return new Date(i.paymentTo) < today;
      });
    } else if (paymentFilter) {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + daysToMonday);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      const from = paymentFilter === "thisWeek" ? monday : new Date(monday.getTime() + 7 * 86400000);
      const to = paymentFilter === "thisWeek" ? sunday : new Date(sunday.getTime() + 7 * 86400000);
      list = list.filter((i) => {
        if (!i.paymentTo) return false;
        const d = new Date(i.paymentTo);
        return d >= from && d <= to;
      });
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    function isToday(paymentTo?: string) {
      return paymentTo?.slice(0, 10) === todayStr;
    }
    return [...list].sort((a, b) => {
      const aToday = isToday(a.paymentTo) ? 0 : 1;
      const bToday = isToday(b.paymentTo) ? 0 : 1;
      if (aToday !== bToday) return aToday - bToday;
      let cmp = 0;
      switch (sortField) {
        case "number":
          cmp = (a.number ?? "").localeCompare(b.number ?? "", "pl");
          break;
        case "kind":
          cmp = a.kind.localeCompare(b.kind, "pl");
          break;
        case "status":
          cmp = (a.status ?? "").localeCompare(b.status ?? "", "pl");
          break;
        case "buyerName":
          cmp = (a.buyerName ?? "").localeCompare(b.buyerName ?? "", "pl");
          break;
        case "issueDate":
          cmp = (a.issueDate ?? "").localeCompare(b.issueDate ?? "");
          break;
        case "paymentTo":
          cmp = (a.paymentTo ?? "").localeCompare(b.paymentTo ?? "");
          break;
        case "grossAmount":
          cmp = (a.grossAmount ?? 0) - (b.grossAmount ?? 0);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [invoices, kindFilter, paymentFilter, sortField, sortDir]);

  const isLoading = invoices === undefined;

  // Build fakturownia URL
  const subdomain = config?.subdomain;
  function fakturowniaUrl(remoteId: string) {
    if (!subdomain) return null;
    return `https://${subdomain}.fakturownia.pl/invoices/${remoteId}`;
  }

  // Order lookup map
  const orderMap = useMemo(() => {
    if (!orders) return new Map<string, OrderItem>();
    return new Map(orders.map((o) => [o._id, o]));
  }, [orders]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Kind filters */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setKindFilter("")}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              kindFilter === ""
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900"
            }`}
          >
            Wszystkie
            {invoices && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${kindFilter === "" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
                {invoices.length}
              </span>
            )}
          </button>
          {allKinds.map((kind) => (
            <button
              key={kind}
              onClick={() => setKindFilter(kindFilter === kind ? "" : kind)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                kindFilter === kind
                  ? "bg-blue-100 text-blue-800 border-blue-300"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-700"
              }`}
            >
              {KIND_LABELS[kind] ?? kind}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${kindFilter === kind ? "bg-black/10" : "bg-gray-100 text-gray-500"}`}>
                {kindCounts[kind] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Sync controls */}
        <div className="flex items-center gap-3">
          {lastSyncAt > 0 && !syncing && (
            <span className="text-xs text-gray-400">
              Synchronizacja: {relativeTime(lastSyncAt)}
            </span>
          )}
          {syncResult && !syncing && (
            <span className="text-xs text-emerald-600">
              Pobrano {syncResult.count} faktur
            </span>
          )}
          {syncError && (
            <span className="max-w-xs truncate text-xs text-red-500">{syncError}</span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Synchronizuję…" : "Odśwież"}
          </button>
        </div>
      </div>

        {/* Payment date filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Płatność:</span>
          {(["", "thisWeek", "nextWeek"] as PaymentFilter[]).map((val) => {
            const label = val === "" ? "Wszystkie terminy" : val === "thisWeek" ? "Ten tydzień" : "Następny tydzień";
            return (
              <button
                key={val}
                onClick={() => setPaymentFilter(paymentFilter === val ? "" : val)}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  paymentFilter === val
                    ? "bg-amber-100 text-amber-800 border-amber-300"
                    : "bg-white text-gray-600 border-gray-200 hover:border-amber-300 hover:text-amber-700"
                }`}
              >
                {label}
              </button>
            );
          })}
          <button
            onClick={() => setPaymentFilter(paymentFilter === "overdue" ? "" : "overdue")}
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              paymentFilter === "overdue"
                ? "bg-red-100 text-red-800 border-red-300"
                : "bg-white text-red-600 border-red-200 hover:border-red-400 hover:text-red-800"
            }`}
          >
            Windykacja
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <TableRoot>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell
                  onClick={() => handleSort("number")}
                  className="cursor-pointer select-none hover:bg-gray-50"
                >
                  Numer
                  <SortIcon field="number" sortField={sortField} sortDir={sortDir} />
                </TableHeaderCell>
                <TableHeaderCell
                  onClick={() => handleSort("kind")}
                  className="cursor-pointer select-none hover:bg-gray-50"
                >
                  Rodzaj
                  <SortIcon field="kind" sortField={sortField} sortDir={sortDir} />
                </TableHeaderCell>
                <TableHeaderCell
                  onClick={() => handleSort("status")}
                  className="cursor-pointer select-none hover:bg-gray-50"
                >
                  Status
                  <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
                </TableHeaderCell>
                <TableHeaderCell
                  onClick={() => handleSort("buyerName")}
                  className="cursor-pointer select-none hover:bg-gray-50"
                >
                  Nabywca
                  <SortIcon field="buyerName" sortField={sortField} sortDir={sortDir} />
                </TableHeaderCell>
                <TableHeaderCell
                  onClick={() => handleSort("issueDate")}
                  className="cursor-pointer select-none hover:bg-gray-50"
                >
                  Data wystawienia
                  <SortIcon field="issueDate" sortField={sortField} sortDir={sortDir} />
                </TableHeaderCell>
                <TableHeaderCell
                  onClick={() => handleSort("paymentTo")}
                  className="cursor-pointer select-none hover:bg-gray-50"
                >
                  Data płatności
                  <SortIcon field="paymentTo" sortField={sortField} sortDir={sortDir} />
                </TableHeaderCell>
                <TableHeaderCell
                  onClick={() => handleSort("grossAmount")}
                  className="cursor-pointer select-none hover:bg-gray-50 text-right"
                >
                  Kwota brutto
                  <SortIcon field="grossAmount" sortField={sortField} sortDir={sortDir} />
                </TableHeaderCell>
                <TableHeaderCell>Zlecenie</TableHeaderCell>
                <TableHeaderCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {(isLoading || syncing) && !invoices &&
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

              {!isLoading && displayed && displayed.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center text-gray-400">
                    {invoices?.length === 0
                      ? "Brak faktur. Kliknij Odśwież aby pobrać z Fakturowni."
                      : "Brak faktur dla wybranego filtra."}
                  </TableCell>
                </TableRow>
              )}

              {displayed?.map((invoice) => {
                const assignedOrder = invoice.orderId ? orderMap.get(invoice.orderId as string) : null;
                const invoiceUrl = fakturowniaUrl(invoice.remoteId);
                return (
                  <TableRow key={invoice._id} className="hover:bg-gray-50 transition-colors">
                    {/* Number */}
                    <TableCell className="whitespace-nowrap font-mono text-sm text-gray-900">
                      <div className="flex items-center gap-1.5">
                        {invoice.number ?? <span className="text-gray-400">#{invoice.remoteId}</span>}
                        {invoiceUrl && (
                          <a
                            href={invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-blue-500 transition-colors"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                      </div>
                    </TableCell>

                    {/* Kind */}
                    <TableCell>
                      <Badge variant={KIND_VARIANTS[invoice.kind] ?? "neutral"}>
                        {KIND_LABELS[invoice.kind] ?? invoice.kind}
                      </Badge>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      {invoice.status ? (
                        <Badge variant={STATUS_VARIANTS[invoice.status] ?? "neutral"}>
                          {STATUS_LABELS[invoice.status] ?? invoice.status}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>

                    {/* Buyer */}
                    <TableCell className="text-sm text-gray-900">
                      {invoice.buyerName ?? <span className="text-gray-400">—</span>}
                    </TableCell>

                    {/* Date */}
                    <TableCell className="whitespace-nowrap text-sm text-gray-600">
                      {invoice.issueDate
                        ? new Date(invoice.issueDate).toLocaleDateString("pl-PL")
                        : <span className="text-gray-400">—</span>}
                    </TableCell>

                    {/* Payment date */}
                    <TableCell className="whitespace-nowrap text-sm text-gray-600">
                      {invoice.paymentTo ? (() => {
                        const d = new Date(invoice.paymentTo);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const isOverdue = d < today && invoice.status !== "paid";
                        return isOverdue ? (
                          <Badge variant="error">
                            <AlertTriangle className="mr-1 inline size-3 shrink-0" />
                            {d.toLocaleDateString("pl-PL")}
                          </Badge>
                        ) : (
                          d.toLocaleDateString("pl-PL")
                        );
                      })() : <span className="text-gray-400">—</span>}
                    </TableCell>

                    {/* Amount */}
                    <TableCell className="text-right tabular-nums text-sm text-gray-900 whitespace-nowrap">
                      {invoice.grossAmount != null
                        ? `${invoice.grossAmount.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${invoice.currency ?? "PLN"}`
                        : <span className="text-gray-400">—</span>}
                    </TableCell>

                    {/* Order */}
                    <TableCell>
                      {assignedOrder ? (
                        <Link
                          href={`/admin/klient/${assignedOrder.clientId}/zlecenie/${assignedOrder._id}`}
                          className="group flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                        >
                          <Link2 className="size-3.5 shrink-0" />
                          <span className="max-w-[140px] truncate">
                            {assignedOrder.client
                              ? `${assignedOrder.client.lastName} ${assignedOrder.client.firstName}`
                              : assignedOrder.name ?? assignedOrder._id}
                          </span>
                          {assignedOrder.name && (
                            <span className="font-mono text-gray-400">{assignedOrder.name}</span>
                          )}
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-400">Nie przypisano</span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <button
                        onClick={() => setAssigningInvoice(invoice)}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900"
                      >
                        <Link2 className="size-3.5" />
                        {invoice.orderId ? "Zmień" : "Przypisz"}
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableRoot>
      </div>

      {/* Assignment modal */}
      {assigningInvoice && orders && (
        <AssignModal
          invoice={assigningInvoice}
          orders={orders}
          onAssign={handleAssign}
          onUnassign={handleUnassign}
          onClose={() => setAssigningInvoice(null)}
        />
      )}
    </div>
  );
}
