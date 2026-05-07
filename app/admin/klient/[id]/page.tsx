"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock } from "lucide-react";
import InlineEdit from "./InlineEdit";
import CityDistance from "./CityDistance";
import Notes from "./Notes";
import ClientMailTab from "./ClientMailTab";
import AddressSearch, { type AddressData } from "@/components/AddressSearch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/ui/Table";
import { StatusPill, CrmAvatar, fmtDate, CrmEmptyState } from "@/components/crm-ui";
import DocumentProgressTiles from "./DocumentProgressTiles";
import NewOrderModal from "./NewOrderModal";

type Tab = "zlecenia" | "notatki" | "mail";

function relativeTime(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86_400_000)
  if (days === 0) return "dziś"
  if (days === 1) return "wczoraj"
  if (days < 7) return `${days} dni temu`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} tyg. temu`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} mies. temu`
  return `${Math.floor(days / 365)} lat temu`
}

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const clientId = id as Id<"clients">;
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>("zlecenia");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [sendingAddress, setSendingAddress] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);

  const client = useQuery(api.clients.getById, { clientId });
  const orders = useQuery(api.orders.listByClient, { clientId });
  const updateClient = useMutation(api.clients.update);
  const deleteClient = useAction(api.clients.deleteClient);
  const sendAddressSms = useAction(api.sms.sendAddressSms);
  const createClientFolder = useAction(api.googleDrive.createClientFolder);

  if (client === undefined) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 256 }}>
        <span className="mute" style={{ fontSize: 13 }}>Ładowanie…</span>
      </div>
    );
  }

  if (client === null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 256, gap: 16 }}>
        <span className="mute" style={{ fontSize: 13 }}>Klient nie znaleziony.</span>
        <Link href="/admin" style={{ fontSize: 13, color: "var(--accent)" }}>Wróć do listy</Link>
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

  async function handleCreateFolder() {
    setCreatingFolder(true);
    try {
      await createClientFolder({ clientId });
    } catch (error) {
      console.error("Błąd tworzenia folderu:", error);
    } finally {
      setCreatingFolder(false);
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

  const folderUrl = client.clientFolderUrl ?? client.folderUrl;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Header card ── */}
      <div className="panel" style={{ overflow: "hidden" }}>

        {/* Breadcrumb + actions */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-mute)" }}>
            <Link href="/admin" style={{ color: "var(--text-mute)", textDecoration: "none" }}
              onMouseOver={(e) => (e.currentTarget.style.color = "var(--text)")}
              onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-mute)")}
            >
              Klienci
            </Link>
            <span style={{ opacity: 0.5 }}>›</span>
            <span style={{ color: "var(--text-dim)", fontWeight: 500 }}>{client.firstName} {client.lastName}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {folderUrl ? (
              <a href={folderUrl} target="_blank" rel="noopener noreferrer" className="btn" style={{ fontSize: 11 }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
                </svg>
                Folder
              </a>
            ) : (
              <button onClick={handleCreateFolder} disabled={creatingFolder} className="btn" style={{ fontSize: 11 }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                {creatingFolder ? "Tworzenie…" : "Dodaj folder"}
              </button>
            )}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="btn"
              style={{ fontSize: 11, color: "var(--bad)", borderColor: "oklch(0.72 0.18 25 / 0.4)" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Usuń
            </button>
          </div>
        </div>

        {/* Client identity */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px" }}>
          <CrmAvatar name={`${client.firstName} ${client.lastName}`} size={44} />
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
              {client.firstName} {client.lastName}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              {client.city && <span className="chip">{client.city}</span>}
              {client.phone && <span className="mono mute" style={{ fontSize: 12 }}>{client.phone}</span>}
              {client.email && <span className="dim" style={{ fontSize: 12 }}>{client.email}</span>}
            </div>
          </div>
        </div>

        {/* Contact fields */}
        <div style={{ borderTop: "1px solid var(--line)", padding: "14px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
            <InlineEdit label="Imię" value={client.firstName} onSave={(v) => handleFieldSave("firstName", v)} />
            <InlineEdit label="Nazwisko" value={client.lastName} onSave={(v) => handleFieldSave("lastName", v)} />
            <InlineEdit label="Email" value={client.email ?? ""} onSave={(v) => handleFieldSave("email", v)} placeholder="brak" />
            <InlineEdit label="Telefon" value={client.phone ?? ""} onSave={(v) => handleFieldSave("phone", v)} placeholder="brak" />
            <InlineEdit label="NIP" value={client.nip ?? ""} onSave={(v) => handleFieldSave("nip", v)} placeholder="brak" />
          </div>

          <div>
            <p className="up mute" style={{ marginBottom: 6 }}>Adres</p>
            <AddressSearch onSelect={handleAddressSelect} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
            <InlineEdit label="Kod pocztowy" value={client.postalCode ?? ""} onSave={(v) => handleFieldSave("postalCode", v)} placeholder="brak" />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <InlineEdit label="Miejscowość" value={client.city ?? ""} onSave={(v) => handleFieldSave("city", v)} placeholder="brak" />
              {client.city && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([client.street, client.buildingNumber, client.postalCode, client.city].filter(Boolean).join(" "))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none" }}
                  >
                    Google Maps ↗
                  </a>
                  <CityDistance city={client.city} />
                </div>
              )}
            </div>
            <InlineEdit label="Ulica" value={client.street ?? ""} onSave={(v) => handleFieldSave("street", v)} placeholder="brak" />
            <InlineEdit label="Nr budynku" value={client.buildingNumber ?? ""} onSave={(v) => handleFieldSave("buildingNumber", v)} placeholder="brak" />
            <InlineEdit label="Nr mieszkania" value={client.apartmentNumber ?? ""} onSave={(v) => handleFieldSave("apartmentNumber", v)} placeholder="brak" />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderTop: "1px solid var(--line)", gap: 2 }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "9px 16px",
                fontSize: 12.5,
                fontWeight: activeTab === tab.key ? 600 : 500,
                color: activeTab === tab.key ? "var(--accent)" : "var(--text-mute)",
                borderBottom: activeTab === tab.key ? "2px solid var(--accent)" : "2px solid transparent",
                marginBottom: -1,
                background: "none",
                border: "none",
                borderBottomStyle: "solid",
                cursor: "pointer",
                fontFamily: "inherit",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  padding: "1px 6px", borderRadius: 999,
                  background: activeTab === tab.key ? "var(--accent)" : "var(--panel-3)",
                  color: activeTab === tab.key ? "#fff" : "var(--text-mute)",
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab: Zlecenia ── */}
      {activeTab === "zlecenia" && (
        <div className="panel" style={{ overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
            <span className="up mute">Zlecenia</span>
            <button onClick={() => setShowNewOrderModal(true)} className="btn primary" style={{ fontSize: 11 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nowe zlecenie
            </button>
          </div>
          <TableRoot>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Zlecenie</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Dokumenty</TableHeaderCell>
                  <TableHeaderCell>Usługi</TableHeaderCell>
                  <TableHeaderCell>Data</TableHeaderCell>
                  <TableHeaderCell style={{ textAlign: "right" }}>Kwota brutto</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders === undefined && Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><div style={{ height: 14, borderRadius: 4, background: "var(--panel-3)", animation: "pulse 1.5s ease-in-out infinite" }} /></TableCell>
                    ))}
                  </TableRow>
                ))}

                {orders !== undefined && orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}><CrmEmptyState message="Brak zleceń dla tego klienta." /></TableCell>
                  </TableRow>
                )}

                {orders?.map((order) => {
                  const isCompleted = order.status === "completed";
                  const hasFinalInvoice = (order.fakturownia?.invoices ?? []).some((inv) => inv.kind === "final");
                  return (
                    <TableRow key={order._id} style={isCompleted ? { background: "var(--ok-soft)", cursor: "pointer" } : { cursor: "pointer" }} onClick={() => router.push(`/admin/klient/${id}/zlecenie/${order._id}`)}>
                      <TableCell>
                        <div className="strong" style={{ fontWeight: 500, fontSize: 12.5 }}>
                          {order.name ?? <span className="mute">Zlecenie z {fmtDate(order._creationTime)}</span>}
                        </div>
                        {hasFinalInvoice && (
                          <span className="chip" style={{ marginTop: 2 }}>Faktura wystawiona</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusPill status={order.status} />
                      </TableCell>
                      <TableCell>
                        <DocumentProgressTiles documents={order.documents} />
                      </TableCell>
                      <TableCell>
                        {order.services && order.services.length > 0
                          ? <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                              {order.services.map((s) => <span key={s} className="chip">{s}</span>)}
                            </div>
                          : <span className="mute">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="mono" style={{ fontSize: 11 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <CalendarDays size={11} style={{ color: "var(--text-mute)" }} />
                            {fmtDate(order._creationTime)}
                          </div>
                          <div className="mute" style={{ fontSize: 10.5, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                            <Clock size={10} />
                            {relativeTime(order._creationTime)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="mono tnum" style={{ textAlign: "right" }}>
                        {order.totalGross != null
                          ? `${order.totalGross.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
                          : <span className="mute">—</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableRoot>
        </div>
      )}

      {/* ── Tab: Notatki ── */}
      {activeTab === "notatki" && <Notes clientId={clientId} />}

      {/* ── Tab: Mail ── */}
      {activeTab === "mail" && (
        <div className="panel" style={{ overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
            <span className="up mute">Korespondencja email</span>
          </div>
          <div style={{ padding: 16 }}>
            <ClientMailTab clientEmail={client.email ?? ""} />
          </div>
        </div>
      )}

      {/* New Order Modal */}
      {showNewOrderModal && (
        <NewOrderModal
          clientId={clientId}
          onClose={() => setShowNewOrderModal(false)}
          onSuccess={(orderId) => {
            setShowNewOrderModal(false);
            router.push(`/admin/klient/${id}/zlecenie/${orderId}`);
          }}
        />
      )}

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", padding: 16 }}>
          <div className="panel" style={{ width: "100%", maxWidth: 400, padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px", color: "var(--text-strong)" }}>Usunąć klienta?</h2>
            <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "0 0 4px" }}>
              Czy na pewno chcesz usunąć <strong>{client.firstName} {client.lastName}</strong>?
            </p>
            <p style={{ fontSize: 12.5, color: "var(--text-mute)", margin: "0 0 24px" }}>
              Zostaną usunięte wszystkie zlecenia, dokumenty i foldery na Google Drive.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading} className="btn">
                Anuluj
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="btn"
                style={{ background: "var(--bad)", color: "#fff", borderColor: "transparent" }}
              >
                {deleteLoading ? "Usuwanie…" : "Tak, usuń klienta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
