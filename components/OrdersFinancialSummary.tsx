"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { Search, TrendingUp, TrendingDown, DollarSign, ExternalLink, Calendar, X } from "lucide-react";
import { useState, useMemo } from "react";

export function OrdersFinancialSummary() {
  const allOrders = useQuery(api.orders.listAllForFinanse) ?? [];
  const allInvoices = useQuery(api.fakturownia.listCachedInvoices) ?? [];
  const allExpenses = useQuery(api.fakturownia.listCachedExpenses) ?? [];

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const ordersData = useMemo(() => {
    return allOrders.map((order) => {
      const orderInvs = allInvoices.filter((inv) => inv.orderId === order._id);
      const orderExps = allExpenses.filter((exp) => exp.orderId === order._id);

      const estimateInvs = orderInvs.filter((inv) => inv.kind === "estimate" || inv.kind === "order");
      const estimateNet = estimateInvs.reduce((sum, inv) => sum + (inv.netAmount ?? 0), 0);

      const regularInvs = orderInvs.filter((inv) => inv.kind !== "estimate" && inv.kind !== "order");
      const invNet = regularInvs.reduce((sum, inv) => sum + (inv.netAmount ?? 0), 0);

      const expNet = orderExps.reduce((sum, exp) => sum + (exp.netAmount ?? 0), 0);
      const balNet = invNet - expNet;
      const marginPct = invNet > 0 ? (balNet / invNet) * 100 : null;

      // Data do filtrowania - z nazwy (np. "27/05/2026"), z pierwszego terminu montażu lub _creationTime
      let orderTs = order._creationTime;
      if (order.installationDates && order.installationDates.length > 0) {
        orderTs = order.installationDates[0].date;
      } else if (order.projectEndDate) {
        orderTs = order.projectEndDate;
      }

      return {
        ...order,
        orderTs,
        estimateNet,
        invNet,
        expNet,
        balNet,
        marginPct,
      };
    });
  }, [allOrders, allInvoices, allExpenses]);

  const filteredOrders = useMemo(() => {
    let result = ordersData;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) =>
          (o.name && o.name.toLowerCase().includes(q)) ||
          (o.clientName && o.clientName.toLowerCase().includes(q)) ||
          (o.customText && o.customText.toLowerCase().includes(q))
      );
    }

    if (dateFrom) {
      const fromTs = new Date(dateFrom).getTime();
      result = result.filter((o) => o.orderTs >= fromTs);
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      const toTs = toDate.getTime();
      result = result.filter((o) => o.orderTs <= toTs);
    }

    return result;
  }, [ordersData, search, dateFrom, dateTo]);

  const totals = useMemo(() => {
    const totalEstimate = filteredOrders.reduce((sum, o) => sum + o.estimateNet, 0);
    const totalInvoiced = filteredOrders.reduce((sum, o) => sum + o.invNet, 0);
    const totalExpenses = filteredOrders.reduce((sum, o) => sum + o.expNet, 0);
    const totalProfit = totalInvoiced - totalExpenses;
    const totalMargin = totalInvoiced > 0 ? (totalProfit / totalInvoiced) * 100 : 0;

    return {
      totalEstimate,
      totalInvoiced,
      totalExpenses,
      totalProfit,
      totalMargin,
    };
  }, [filteredOrders]);

  const fmt = (val: number) =>
    val.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";

  return (
    <div className="space-y-6">
      {/* Global Kpi Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold uppercase tracking-wider">Suma Wycen (Netto)</span>
            <DollarSign className="size-4 text-blue-500" />
          </div>
          <div className="mt-2 text-xl font-bold text-gray-900">{fmt(totals.totalEstimate)}</div>
          <div className="mt-1 text-xs text-gray-500">Wartość kosztorysowa zgonie z fakturami proforma / zamówieniami</div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold uppercase tracking-wider">Faktury Przychody (Netto)</span>
            <TrendingUp className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-xl font-bold text-emerald-600">{fmt(totals.totalInvoiced)}</div>
          <div className="mt-1 text-xs text-gray-500">Faktycznie zafakturowany przychód z Fakturowni</div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold uppercase tracking-wider">Koszty i Wydatki (Netto)</span>
            <TrendingDown className="size-4 text-rose-500" />
          </div>
          <div className="mt-2 text-xl font-bold text-rose-600">{fmt(totals.totalExpenses)}</div>
          <div className="mt-1 text-xs text-gray-500">Suma faktur kosztowych i kosztów własnych</div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold uppercase tracking-wider">Zysk / Bilans Netto</span>
            <span
              className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-bold ${
                totals.totalProfit >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              Marża: {totals.totalMargin.toFixed(1)}%
            </span>
          </div>
          <div className={`mt-2 text-xl font-bold ${totals.totalProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {fmt(totals.totalProfit)}
          </div>
          <div className="mt-1 text-xs text-gray-500">Różnica: Przychody - Koszty całkowite</div>
        </div>
      </div>

      {/* Search and Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
            {/* Wyszukiwarka tekstowa */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-2.5 size-4 text-gray-400" />
              <input
                type="text"
                placeholder="Szukaj zlecenia po nazwie, klencie..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-4 py-2 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Filtr daty Od */}
            <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-600">
              <Calendar className="size-3.5 text-gray-400 shrink-0" />
              <span className="font-semibold text-gray-500">Od:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="border-none bg-transparent p-0 text-xs text-gray-800 focus:outline-none font-medium"
              />
            </div>

            {/* Filtr daty Do */}
            <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-600">
              <Calendar className="size-3.5 text-gray-400 shrink-0" />
              <span className="font-semibold text-gray-500">Do:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="border-none bg-transparent p-0 text-xs text-gray-800 focus:outline-none font-medium"
              />
            </div>

            {/* Reset filtrów */}
            {(dateFrom || dateTo || search) && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setDateFrom("");
                  setDateTo("");
                }}
                className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-100 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 transition"
              >
                <X className="size-3.5" />
                Wyczyszcz
              </button>
            )}
          </div>

          <span className="text-xs text-gray-500 font-medium shrink-0">
            Wyświetlane zlecenia: <strong>{filteredOrders.length}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-gray-200 bg-gray-100/60 text-gray-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Zlecenie / Klient</th>
                <th className="px-4 py-3 text-right">Wycena (Netto)</th>
                <th className="px-4 py-3 text-right">Zafakturowano (Netto)</th>
                <th className="px-4 py-3 text-right">Koszty (Netto)</th>
                <th className="px-4 py-3 text-right">Bilans (Netto)</th>
                <th className="px-4 py-3 text-right">Marża %</th>
                <th className="px-4 py-3 text-center">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 font-medium">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 font-normal">
                    Brak zleceń spełniających kryteria wyszukiwania.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => {
                  const isPositive = o.balNet >= 0;
                  return (
                    <tr key={o._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-900">{o.name ?? "Zlecenie bez nazwy"}</div>
                        <div className="text-gray-500 text-[11px]">{o.clientName}</div>
                        {o.customText && (
                          <div className="text-blue-600 text-[11px] italic mt-0.5">{o.customText}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 font-semibold">{fmt(o.estimateNet)}</td>
                      <td className="px-4 py-3 text-right text-emerald-700 font-semibold">{fmt(o.invNet)}</td>
                      <td className="px-4 py-3 text-right text-rose-700 font-semibold">{fmt(o.expNet)}</td>
                      <td className={`px-4 py-3 text-right font-bold ${isPositive ? "text-emerald-700" : "text-rose-700"}`}>
                        {fmt(o.balNet)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {o.marginPct !== null ? (
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${
                              o.marginPct >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {o.marginPct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/admin/klient/${o.clientId}/zlecenie/${o._id}?tab=finanse`}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 shadow-sm hover:bg-gray-50 hover:text-blue-600 transition"
                        >
                          Finanse zlecenia
                          <ExternalLink className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
