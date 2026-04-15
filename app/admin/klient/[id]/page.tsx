"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { useRouter } from "next/navigation";
import InlineEdit from "./InlineEdit";
import CityDistance from "./CityDistance";
import Notes from "./Notes";
import ClientMailTab from "./ClientMailTab";
import AddressSearch, { type AddressData } from "@/components/AddressSearch";
import { useStatusLabels } from "@/components/StatusLabelsContext";

type Tab = "zlecenia" | "notatki" | "mail";

function fmt(n: number) {
  return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  lead: "bg-slate-100 text-slate-700 border-slate-200",
  inquiry: "bg-blue-50 text-blue-700 border-blue-200",
  measurement: "bg-amber-50 text-amber-700 border-amber-200",
  offer: "bg-indigo-50 text-indigo-700 border-indigo-200",
  contract: "bg-emerald-50 text-emerald-700 border-emerald-200",
  production: "bg-violet-50 text-violet-700 border-violet-200",
  installation: "bg-orange-50 text-orange-700 border-orange-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  warranty: "bg-rose-50 text-rose-700 border-rose-200",
};

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const clientId = id as Id<"clients">;
  const router = useRouter();

  const statusLabels = useStatusLabels();
  const [activeTab, setActiveTab] = useState<Tab>("zlecenia");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [sendingAddress, setSendingAddress] = useState(false);
  const client = useQuery(api.clients.getById, { clientId });
  const orders = useQuery(api.orders.listByClient, { clientId });
  const updateClient = useMutation(api.clients.update);
  const deleteClient = useAction(api.clients.deleteClient);
  const sendAddressSms = useAction(api.sms.sendAddressSms);

  if (client === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-slate-400">Ladowanie...</div>
      </div>
    );
  }

  if (client === null) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <div className="text-sm text-slate-500">Klient nie znaleziony.</div>
        <Link href="/admin" className="text-sm text-blue-600 hover:underline">
          Wroc do listy
        </Link>
      </div>
    );
  }

  function handleFieldSave(field: string, value: string) {
    void updateClient({ clientId, [field]: value });
  }

  function handleAddressSelect(address: AddressData) {
    const updates: Record<string, string> = {};
    if (address.street) updates.street = address.street;
    if (address.buildingNumber) updates.buildingNumber = address.buildingNumber;
    if (address.city) updates.city = address.city;
    if (address.postalCode) updates.postalCode = address.postalCode;
    if (Object.keys(updates).length > 0) {
      void updateClient({ clientId, ...updates });
    }
  }

  async function handleSendAddress() {
    setSendingAddress(true);
    try {
      await sendAddressSms({ clientId });
    } catch (error) {
      console.error("Błąd wysyłki SMS z adresem:", error);
    } finally {
      setSendingAddress(false);
    }
  }

  async function handleDelete() {
    setDeleteLoading(true);
    try {
      await deleteClient({ clientId });
      router.push("/admin");
    } catch (error) {
      console.error("Client deletion failed:", error);
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  }

  const tabs: Array<{ key: Tab; label: string; count?: number }> = [
    { key: "zlecenia", label: "Zlecenia", count: orders?.length },
    { key: "notatki", label: "Notatki" },
    { key: "mail", label: "Mail" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-lg font-black text-blue-700">
              {getInitials(client.firstName, client.lastName)}
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                <Link href="/admin" className="hover:text-slate-600">Klienci</Link>
                <span>/</span>
                <span className="text-slate-600">{client.firstName} {client.lastName}</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                {client.firstName} {client.lastName}
              </h1>
              {client.city && (
                <p className="mt-0.5 text-sm text-slate-400">{client.city}</p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {(client.clientFolderUrl ?? client.folderUrl) && (
              <a
                href={(client.clientFolderUrl ?? client.folderUrl)!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
                </svg>
                Folder klienta
              </a>
            )}
            <button
              onClick={() => void handleSendAddress()}
              disabled={sendingAddress}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
              </svg>
              {sendingAddress ? "Wysyłanie..." : "Wyślij adres"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
            >
              Usun
            </button>
          </div>
        </div>

        {/* Contact fields */}
        <div className="border-t border-slate-100 px-6 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            <InlineEdit label="Imię" value={client.firstName}
              onSave={(value) => handleFieldSave("firstName", value)} />
            <InlineEdit label="Nazwisko" value={client.lastName}
              onSave={(value) => handleFieldSave("lastName", value)} />
            <InlineEdit label="Email" value={client.email ?? ""}
              onSave={(value) => handleFieldSave("email", value)} placeholder="brak" />
            <InlineEdit label="Telefon" value={client.phone ?? ""}
              onSave={(value) => handleFieldSave("phone", value)} placeholder="brak" />
            <InlineEdit label="NIP" value={client.nip ?? ""}
              onSave={(value) => handleFieldSave("nip", value)} placeholder="brak" />
          </div>
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Adres
              </p>
              <AddressSearch onSelect={handleAddressSelect} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            <InlineEdit label="Kod pocztowy" value={client.postalCode ?? ""}
              onSave={(value) => handleFieldSave("postalCode", value)} placeholder="brak" />
            <div className="flex flex-col gap-1">
              <InlineEdit label="Miejscowość" value={client.city ?? ""}
                onSave={(value) => handleFieldSave("city", value)} placeholder="brak" />
              {client.city && (
                <div className="flex items-center gap-3">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([client.street, client.buildingNumber, client.postalCode, client.city].filter(Boolean).join(" "))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                    Google Maps
                  </a>
                  <CityDistance city={client.city} />
                </div>
              )}
            </div>
            <InlineEdit label="Ulica" value={client.street ?? ""}
              onSave={(value) => handleFieldSave("street", value)} placeholder="brak" />
            <InlineEdit label="Nr budynku" value={client.buildingNumber ?? ""}
              onSave={(value) => handleFieldSave("buildingNumber", value)} placeholder="brak" />
            <InlineEdit label="Nr mieszkania" value={client.apartmentNumber ?? ""}
              onSave={(value) => handleFieldSave("apartmentNumber", value)} placeholder="brak" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-slate-100">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 flex-1 px-6 py-3 text-sm font-semibold transition-colors sm:flex-none ${
                activeTab === tab.key
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  activeTab === tab.key ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Zlecenia */}
      {activeTab === "zlecenia" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              Lista zleceń
            </h2>
          </div>

          {orders === undefined ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-sm text-slate-400">Ladowanie...</div>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-700">Brak zleceń</p>
              <p className="mt-1 text-xs text-slate-400">Brak zleceń dla tego klienta.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {orders.map((order) => {
                const statusLabel = statusLabels[order.status] ?? order.status;
                const badgeStyle = STATUS_BADGE_STYLES[order.status] ?? "bg-slate-100 text-slate-700 border-slate-200";
                const servicesSummary = order.services?.slice(0, 3).join(", ") ?? "Brak uslug";
                const createdDate = new Date(order._creationTime).toLocaleDateString("pl-PL", {
                  day: "2-digit", month: "2-digit", year: "numeric"
                });
                const docCount = Object.values(order.documents).filter((d) => d.url).length;
                const totalDocs = Object.keys(order.documents).length;

                return (
                  <Link
                    key={order._id}
                    href={`/admin/klient/${id}/zlecenie/${order._id}`}
                    className="flex flex-col gap-3 px-6 py-5 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-900">
                          {order.name ?? `Zlecenie z ${createdDate}`}
                        </span>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeStyle}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{servicesSummary}</p>
                    </div>

                    <div className="flex items-center gap-5">
                      {order.totals ? (
                        <div className="text-right">
                          <div className="text-sm font-bold text-slate-900">
                            {fmt(order.totals.totalGross)} zł
                          </div>
                          <div className="text-[10px] text-slate-400">
                            brutto · netto {fmt(order.totals.totalNet)} zł
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs italic text-slate-400">Brak wyceny</div>
                      )}
                      <div className="h-8 w-px bg-slate-100" />
                      <div className="text-right">
                        <div className="text-xs font-medium text-slate-700">{docCount}/{totalDocs} dok.</div>
                        <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: totalDocs > 0 ? `${(docCount / totalDocs) * 100}%` : "0%" }}
                          />
                        </div>
                      </div>
                      <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Notatki */}
      {activeTab === "notatki" && <Notes clientId={clientId} />}

      {/* Tab: Mail */}
      {activeTab === "mail" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Korespondencja email</h2>
          </div>
          <div className="p-6">
            <ClientMailTab clientEmail={client.email ?? ""} />
          </div>
        </div>
      )}

      {/* Delete modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold text-slate-900">Usunac klienta?</h2>
            <p className="mb-1 text-sm text-slate-600">
              Czy na pewno chcesz usunac{" "}
              <span className="font-semibold">{client.firstName} {client.lastName}</span>?
            </p>
            <p className="mb-6 text-sm text-slate-500">
              Zostana usuniete wszystkie zlecenia, dokumenty i foldery na Google Drive.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                Anuluj
              </button>
              <button onClick={handleDelete} disabled={deleteLoading}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {deleteLoading ? "Usuwanie..." : "Tak, usun klienta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
