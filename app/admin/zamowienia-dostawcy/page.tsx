"use client"

import { useState, useMemo } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import Link from "next/link"
import { Package, Truck, Calendar, ChevronRight, Search } from "lucide-react"

const STATUS_LABELS: Record<string, string> = {
  lead: "Lead",
  inquiry: "Zapytanie",
  measurement: "Pomiar",
  offer: "Oferta",
  contract: "Umowa",
  production: "Produkcja",
  installation: "Montaż",
  complaint: "Reklamacja",
  completed: "Zakończone",
  archived: "Archiwum",
}

const STATUS_COLORS: Record<string, string> = {
  lead: "#50253F",
  inquiry: "#50253F",
  measurement: "#3E5224",
  offer: "#50253F",
  contract: "#50253F",
  production: "#164555",
  installation: "#533F04",
  complaint: "#533F04",
  completed: "#37471F",
  archived: "#475569",
}

function formatDate(ts?: number): string {
  if (!ts) return "—"
  const d = new Date(ts)
  return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function isOverdue(ts?: number): boolean {
  if (!ts) return false
  return ts < Date.now()
}

export default function SupplierOrdersPage() {
  const orders = useQuery(api.orders.listSupplierOrders)
  const [search, setSearch] = useState("")

  const filteredOrders = useMemo(() => {
    if (!orders) return []
    if (!search.trim()) return orders
    const term = search.toLowerCase()
    return orders.filter(
      (o) =>
        (o.name ?? "").toLowerCase().includes(term) ||
        o.clientName.toLowerCase().includes(term) ||
        o.deliveries.some(
          (d) =>
            d.serviceName.toLowerCase().includes(term) ||
            d.supplierName.toLowerCase().includes(term),
        ),
    )
  }, [orders, search])

  const totalDeliveries = useMemo(() => {
    if (!orders) return 0
    return orders.reduce((sum, o) => sum + o.deliveries.length, 0)
  }, [orders])

  const pendingDeliveries = useMemo(() => {
    if (!orders) return 0
    return orders.reduce(
      (sum, o) => sum + o.deliveries.filter((d) => !d.deliveryDate).length,
      0,
    )
  }, [orders])

  if (!orders) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
          Ładowanie zamówień...
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Zamówienia od dostawcy</h1>
            <p className="mt-0.5 text-xs text-gray-500">
              {orders.length} zleceń · {totalDeliveries} zamówień · {pendingDeliveries} oczekuje na dostawę
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Szukaj po numerze zlecenia, kliencie, usłudze lub dostawcy..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredOrders.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Package className="h-12 w-12 text-gray-300" />
            <p className="mt-4 text-sm font-medium text-gray-500">
              {search ? "Brak wyników wyszukiwania" : "Brak zamówień od dostawców"}
            </p>
            {!search && (
              <p className="mt-1 text-xs text-gray-400">
                Dodaj zamówienia do zleceń, aby je zobaczyć tutaj
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <div
                key={order._id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white"
              >
                {/* Order header */}
                <Link
                  href={`/admin/klient/${order.clientId}/zlecenie/${order._id}`}
                  className="flex items-center justify-between border-b border-gray-100 px-5 py-3 transition-colors hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-gray-100 px-2.5 py-1 font-mono text-sm font-semibold text-gray-800">
                        {order.name ?? "—"}
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                        style={{ background: STATUS_COLORS[order.status] ?? "#64748b" }}
                      >
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </div>
                    <span className="text-sm text-gray-600">{order.clientName}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <span>Zobacz zlecenie</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </Link>

                {/* Deliveries table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="px-5 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">
                          Usługa
                        </th>
                        <th className="px-5 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">
                          Dostawca
                        </th>
                        <th className="px-5 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3" />
                            Data zamówienia
                          </div>
                        </th>
                        <th className="px-5 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">
                          <div className="flex items-center gap-1.5">
                            <Truck className="h-3 w-3" />
                            Data dostawy
                          </div>
                        </th>
                        <th className="px-5 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.deliveries.map((delivery, idx) => {
                        const isDeliveryPending = !delivery.deliveryDate
                        const isOrderOverdue = isOverdue(delivery.deliveryDate)

                        return (
                          <tr
                            key={idx}
                            className={`border-b border-gray-50 transition-colors hover:bg-gray-50/50 ${
                              idx === order.deliveries.length - 1 ? "border-b-0" : ""
                            }`}
                          >
                            <td className="px-5 py-3">
                              <span className="font-medium text-gray-800">
                                {delivery.serviceName}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <span className="text-gray-600">{delivery.supplierName}</span>
                            </td>
                            <td className="px-5 py-3">
                              <span className="text-gray-600">
                                {formatDate(delivery.orderDate)}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <span
                                className={
                                  isDeliveryPending
                                    ? "text-gray-400"
                                    : isOrderOverdue
                                      ? "font-medium text-red-600"
                                      : "text-gray-600"
                                }
                              >
                                {formatDate(delivery.deliveryDate)}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              {delivery.deliveryDate ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                  Dostarczono
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                  Oczekuje
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
