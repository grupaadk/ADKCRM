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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/Badge";

type Tab = "zlecenia" | "notatki" | "mail";

function SkeletonRow() {
  return (
    <TableRow className="animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <TableCell key={i}>
          <div className="h-4 rounded bg-gray-200" />
        </TableCell>
      ))}
    </TableRow>
  );
}

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
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        {/* Top bar: navigation + actions */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Link href="/admin" className="hover:text-slate-600 transition-colors">Klienci</Link>
            <svg className="h-3 w-3 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" /></svg>
            <span className="font-medium text-slate-600">{client.firstName} {client.lastName}</span>
          </div>

          <div className="flex items-center gap-2">
            {(client.clientFolderUrl ?? client.folderUrl) && (
              <a
                href={(client.clientFolderUrl ?? client.folderUrl)!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-transparent bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
                </svg>
                Folder
              </a>
            )}
            <button
              onClick={() => void handleSendAddress()}
              disabled={sendingAddress}
              className="flex items-center gap-1.5 rounded-lg border border-transparent bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
              </svg>
              {sendingAddress ? "Wysyłanie..." : "Wyślij adres"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 hover:border-red-300"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
              Usuń
            </button>
          </div>
        </div>

        {/* Main heading */}
        <div className="flex items-center gap-4 px-6 pt-5 pb-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-lg font-black text-blue-700">
            {getInitials(client.firstName, client.lastName)}
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900">
              {client.firstName} {client.lastName}
            </h1>
            {client.city && (
              <p className="mt-0.5 text-sm text-slate-400">{client.city}</p>
            )}
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
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <TableRoot>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Zlecenie</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Usługi</TableHeaderCell>
                  <TableHeaderCell>Data utworzenia</TableHeaderCell>
                  <TableHeaderCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {orders === undefined &&
                  Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}

                {orders !== undefined && orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-gray-400">
                      Brak zleceń dla tego klienta.
                    </TableCell>
                  </TableRow>
                )}

                {orders?.map((order) => {
                  const createdDate = new Date(order._creationTime).toLocaleDateString("pl-PL");
                  const isCompleted = order.status === "completed";
                  const hasFinalInvoice = (order.fakturownia?.invoices ?? []).some((inv) => inv.kind === "final");
                  return (
                    <TableRow key={order._id} className={`transition-colors ${isCompleted ? "border-l-4 border-l-green-400 bg-green-50/40 hover:bg-green-50/70" : "hover:bg-gray-50"}`}>
                      <TableCell className="font-medium text-gray-900">
                        {order.name ?? `Zlecenie z ${createdDate}`}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={order.status} />
                          {isCompleted && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-700">
                              <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                              Zakończone
                            </span>
                          )}
                          {hasFinalInvoice && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                              <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                              </svg>
                              Faktura wystawiona
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.services && order.services.length > 0
                          ? order.services.join(", ")
                          : <span className="text-gray-400">—</span>}
                      </TableCell>
                      <TableCell>{createdDate}</TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/klient/${id}/zlecenie/${order._id}`}
                          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                        >
                          Szczegóły →
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableRoot>
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
            <h2 className="mb-2 text-lg font-bold text-slate-900">Usunąć klienta?</h2>
            <p className="mb-1 text-sm text-slate-600">
              Czy na pewno chcesz usunąć{" "}
              <span className="font-semibold">{client.firstName} {client.lastName}</span>?
            </p>
            <p className="mb-6 text-sm text-slate-500">
              Zostaną usunięte wszystkie zlecenia, dokumenty i foldery na Google Drive.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                Anuluj
              </button>
              <button onClick={handleDelete} disabled={deleteLoading}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {deleteLoading ? "Usuwanie..." : "Tak, usuń klienta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
