"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/ui/Table";
import { RefreshCw, ExternalLink, ChevronUp, ChevronDown, ChevronsUpDown, Link2, Link2Off, Search, X } from "lucide-react";
import { useMutation } from "convex/react";
import Link from "next/link";
import ModalPortal from "@/components/ModalPortal";
import type { Id } from "@/convex/_generated/dataModel";

type SortField = "number" | "sellerName" | "buyerName" | "issueDate" | "paymentTo" | "grossAmount" | "netAmount";
type SortDir = "asc" | "desc";

type CachedExpense = {
  _id: Id<"fakturowniaExpensesCache">;
  _creationTime: number;
  remoteId: string;
  number?: string;
  kind: string;
  status?: string;
  sellerName?: string;
  buyerName?: string;
  issueDate?: string;
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
  customText?: string;
  status: string;
  client: {
    firstName: string;
    lastName: string;
    city?: string;
    clientType?: "individual" | "business";
    companyName?: string;
  } | null;
};


function formatCurrency(amount: number) {
  return new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function relativeTime(ts: number) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "przed chwilą";
  if (diff < 3600) return `${Math.floor(diff / 60)} min temu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} godz temu`;
  return `${Math.floor(diff / 86400)} dni temu`;
}


// ─── Assignment Modal ─────────────────────────────────────────────────────────

function AssignModal({
  expense,
  orders,
  onAssign,
  onUnassign,
  onClose,
}: {
  expense: CachedExpense;
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
      const company = (o.client?.companyName ?? "").toLowerCase();
      const orderName = (o.name ?? "").toLowerCase();
      const custom = (o.customText ?? "").toLowerCase();
      return clientName.includes(q) || company.includes(q) || orderName.includes(q) || custom.includes(q);
    }).slice(0, 30);
  }, [orders, search]);

  const displayClient = (c: OrderItem["client"]): string => {
    if (!c) return "—";
    if (c.clientType === "business" && c.companyName) return c.companyName;
    return `${c.lastName} ${c.firstName}`;
  };

  const currentOrder = expense.orderId ? orders.find((o) => o._id === expense.orderId) : null;

  return (
    <ModalPortal>
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
              {expense.number ?? expense.remoteId} — {expense.sellerName ?? "—"}
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
                  {displayClient(currentOrder.client)}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  {currentOrder.name && (
                    <span className="text-xs text-gray-500 font-mono">{currentOrder.name}</span>
                  )}
                  {currentOrder.customText && (
                    <span className="chip-custom">{currentOrder.customText}</span>
                  )}
                </div>
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
              const isSelected = order._id === expense.orderId;
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
    </ModalPortal>
  );
}

export default function ExpenseList() {

  const config = useQuery(api.fakturownia.getConfig);
  const expenses = useQuery(api.fakturownia.listCachedExpenses);
  const syncAction = useAction(api.fakturownia.syncExpensesFromFakturownia);
  const assignExpense = useMutation(api.fakturownia.assignExpense);
  const unassignExpense = useMutation(api.fakturownia.unassignExpense);
  const orders = useQuery(api.orders.list, {});
  
  const [assigningExpense, setAssigningExpense] = useState<CachedExpense | null>(null);
  
  async function handleAssign(orderId: Id<"orders">) {
    if (!assigningExpense) return;
    await assignExpense({ expenseId: assigningExpense._id, orderId });
    setAssigningExpense(null);
  }

  async function handleUnassign() {
    if (!assigningExpense) return;
    await unassignExpense({ expenseId: assigningExpense._id });
    setAssigningExpense(null);
  }

  const orderMap = useMemo(() => {
    const map = new Map<string, OrderItem>();
    if (orders) {
      for (const o of orders) {
        map.set(o._id, o as OrderItem);
      }
    }
    return map;
  }, [orders]);


  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ count: number; pages: number; deleted: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [sortField, setSortField] = useState<SortField>("issueDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const autoSyncDone = useRef(false);

  const lastSyncAt = useMemo(() => {
    if (!expenses || expenses.length === 0) return 0;
    return Math.max(...expenses.map((e) => e.syncedAt));
  }, [expenses]);

  const STALE_MS = 1000 * 60 * 30; // 30 minutes
  const isStale = Date.now() - lastSyncAt > STALE_MS;

  useEffect(() => {
    if (autoSyncDone.current) return;
    if (expenses === undefined) return; 
    if (!isStale && expenses.length > 0) return;
    autoSyncDone.current = true;
    handleSync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses]);

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

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  const displayed = useMemo(() => {
    if (!expenses) return undefined;
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? expenses.filter((exp) => {
          const num = (exp.number ?? "").toLowerCase();
          const seller = (exp.sellerName ?? "").toLowerCase();
          return num.includes(q) || seller.includes(q);
        })
      : expenses;

    const list = [...filtered];
    
    return list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "number":
          cmp = (a.number ?? "").localeCompare(b.number ?? "", "pl");
          break;
        case "sellerName":
          cmp = (a.sellerName ?? "").localeCompare(b.sellerName ?? "", "pl");
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
        case "netAmount":
          cmp = (a.netAmount ?? 0) - (b.netAmount ?? 0);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [expenses, searchQuery, sortField, sortDir]);

  const isLoading = expenses === undefined;

  const subdomain = config?.subdomain;
  function fakturowniaUrl(remoteId: string) {
    if (!subdomain) return null;
    return `https://${subdomain}.fakturownia.pl/invoices/${remoteId}`;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Toolbar */}
      <div className="panel" style={{ padding: "10px 12px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 240 }}>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj po numerze lub sprzedawcy…"
              className="w-full rounded-lg border border-gray-300 py-1.5 pl-8 pr-7 text-xs placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          {lastSyncAt > 0 && !syncing && (
            <span className="mute whitespace-nowrap" style={{ fontSize: 11 }}>Sync: {relativeTime(lastSyncAt)}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {syncResult && !syncing && (
            <span style={{ fontSize: 11, color: "var(--ok)" }}>
              Pobrano {syncResult.count}
            </span>
          )}
          {syncError && (
            <span style={{ fontSize: 11, color: "var(--danger)" }}>{syncError}</span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn"
            style={{ fontSize: 11.5, padding: "5px 12px", gap: 6, display: "flex", alignItems: "center" }}
          >
            <RefreshCw size={13} className={syncing ? "spin" : ""} />
            {syncing ? "Synchronizacja…" : "Synchronizuj"}
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="panel" style={{ padding: 40, textAlign: "center", color: "var(--text-mute)" }}>
          Ładowanie…
        </div>
      ) : displayed?.length === 0 ? (
        <div className="panel" style={{ padding: 40, textAlign: "center", color: "var(--text-mute)" }}>
          <p style={{ margin: 0, fontWeight: 500 }}>Brak wydatków w cache</p>
          <p style={{ margin: "4px 0 0", fontSize: 12.5 }}>Uruchom synchronizację, aby pobrać listę z Fakturowni.</p>
        </div>
      ) : (
        <div className="panel" style={{ overflow: "hidden" }}>
          <TableRoot>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell onClick={() => handleSort("number")} style={{ cursor: "pointer", width: 140 }}>
                    Numer {sortField === "number" ? (sortDir === "asc" ? <ChevronUp className="inline size-3" /> : <ChevronDown className="inline size-3" />) : <ChevronsUpDown className="inline size-3 opacity-50" />}
                  </TableHeaderCell>
                  <TableHeaderCell onClick={() => handleSort("sellerName")} style={{ cursor: "pointer", maxWidth: 250 }}>
                    Sprzedawca {sortField === "sellerName" ? (sortDir === "asc" ? <ChevronUp className="inline size-3" /> : <ChevronDown className="inline size-3" />) : <ChevronsUpDown className="inline size-3 opacity-50" />}
                  </TableHeaderCell>
                  <TableHeaderCell onClick={() => handleSort("issueDate")} style={{ cursor: "pointer", width: 100 }}>
                    Data wyst. {sortField === "issueDate" ? (sortDir === "asc" ? <ChevronUp className="inline size-3" /> : <ChevronDown className="inline size-3" />) : <ChevronsUpDown className="inline size-3 opacity-50" />}
                  </TableHeaderCell>
                  <TableHeaderCell onClick={() => handleSort("paymentTo")} style={{ cursor: "pointer", width: 100 }}>
                    Termin {sortField === "paymentTo" ? (sortDir === "asc" ? <ChevronUp className="inline size-3" /> : <ChevronDown className="inline size-3" />) : <ChevronsUpDown className="inline size-3 opacity-50" />}
                  </TableHeaderCell>
                  <TableHeaderCell onClick={() => handleSort("netAmount")} style={{ cursor: "pointer", width: 100, textAlign: "right" }}>
                    Netto {sortField === "netAmount" ? (sortDir === "asc" ? <ChevronUp className="inline size-3" /> : <ChevronDown className="inline size-3" />) : <ChevronsUpDown className="inline size-3 opacity-50" />}
                  </TableHeaderCell>
                  <TableHeaderCell onClick={() => handleSort("grossAmount")} style={{ cursor: "pointer", width: 100, textAlign: "right" }}>
                    Brutto {sortField === "grossAmount" ? (sortDir === "asc" ? <ChevronUp className="inline size-3" /> : <ChevronDown className="inline size-3" />) : <ChevronsUpDown className="inline size-3 opacity-50" />}
                  </TableHeaderCell>
                  <TableHeaderCell style={{ width: 150 }}>Zlecenie</TableHeaderCell>
                  <TableHeaderCell style={{ width: 50 }}></TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {displayed?.map((exp) => {
                  const url = fakturowniaUrl(exp.remoteId);
                  return (
                    <TableRow key={exp._id}>
                      <TableCell style={{ fontWeight: 500, fontSize: 13 }}>
                        {exp.number || "—"}
                      </TableCell>
                      <TableCell style={{ maxWidth: 250, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }} title={exp.sellerName || ""}>
                          {exp.sellerName || "—"}
                        </div>
                      </TableCell>
                      <TableCell style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>
                        {exp.issueDate || "—"}
                      </TableCell>
                      <TableCell style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>
                        {exp.paymentTo || "—"}
                      </TableCell>
                      <TableCell style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-mute)", whiteSpace: "nowrap" }}>
                        {exp.netAmount ? `${formatCurrency(exp.netAmount)} ${exp.currency || "PLN"}` : "—"}
                      </TableCell>
                      
                      <TableCell style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
                        {exp.grossAmount ? `${formatCurrency(exp.grossAmount)} ${exp.currency || "PLN"}` : "—"}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const assignedOrder = exp.orderId ? orderMap.get(exp.orderId as string) : null;
                          if (assignedOrder) {
                            return (
                              <Link
                                href={`/admin/klient/${assignedOrder.clientId}/zlecenie/${assignedOrder._id}?tab=dokumenty`}
                                className="group flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                              >
                                <Link2 className="size-3.5 shrink-0" />
                                <span className="max-w-[140px] truncate">
                                  {assignedOrder.client
                                    ? `${assignedOrder.client.lastName} ${assignedOrder.client.firstName}`
                                    : assignedOrder.name ?? assignedOrder._id}
                                </span>
                              </Link>
                            );
                          }
                          return <span className="text-xs text-gray-400">Nie przypisano</span>;
                        })()}
                      </TableCell>
                      <TableCell>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button
                            onClick={() => setAssigningExpense(exp as CachedExpense)}
                            className="btn"
                            style={{ fontSize: 11 }}
                          >
                            <Link2 className="size-3.5" />
                            {exp.orderId ? "Zmień" : "Przypisz"}
                          </button>
                          {url && (

                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="btn"
                              style={{ padding: "4px 8px", fontSize: 11.5 }}
                              title="Otwórz w Fakturowni"
                            >
                              <ExternalLink size={13} />
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableRoot>
        </div>
      )}
      
      {assigningExpense && orders && (
        <AssignModal
          expense={assigningExpense}
          orders={orders as OrderItem[]}
          onAssign={handleAssign}
          onUnassign={handleUnassign}
          onClose={() => setAssigningExpense(null)}
        />
      )}
    </div>
  );
}
