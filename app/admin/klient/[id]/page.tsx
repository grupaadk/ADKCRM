"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock, ArrowLeft } from "lucide-react";
import InlineEdit from "./InlineEdit";
import CityDistance from "./CityDistance";
import Notes from "./Notes";
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
import NewOpportunityModal from "@/components/NewOpportunityModal";

type Tab = "zlecenia" | "szanse" | "notatki";

const FIELD_LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-mute)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  display: "block",
  marginBottom: 4,
};

const KPI_CARD: React.CSSProperties = {
  padding: "10px 12px",
  background: "var(--panel-2)",
  borderRadius: 6,
  display: "flex",
  flexDirection: "column",
  gap: 3,
};

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
  const [showNewOppModal, setShowNewOppModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);

  const client = useQuery(api.clients.getById, { clientId });
  const orders = useQuery(api.orders.listByClient, { clientId });
  const opportunities = useQuery(api.salesOpportunities.listByClient, { clientId });
  const updateClient = useMutation(api.clients.update);
  const deleteClient = useAction(api.clients.deleteClient);
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

  const folderUrl = client.clientFolderUrl ?? client.folderUrl;
  const totalOrders = orders?.length ?? 0;
  const completedOrders = orders?.filter((o) => o.status === "completed").length ?? 0;
  const totalGross = orders?.reduce((sum, o) => sum + ((o as { totalGross?: number }).totalGross ?? 0), 0) ?? 0;
  const totalConfirmedOrdersGross = orders
    ?.filter((o) => !["measurement", "offer", "lead", "inquiry"].includes(o.status))
    .reduce((sum, o) => sum + ((o as { totalGross?: number }).totalGross ?? 0), 0) ?? 0;
  const totalOpportunities = opportunities?.length ?? 0;
  const totalOppPrice = opportunities?.reduce((sum, o) => sum + (o.price ?? 0), 0) ?? 0;

  const tabs: Array<{ key: Tab; label: string; count?: number }> = [
    { key: "zlecenia", label: "Zlecenia", count: orders?.length },
    { key: "szanse", label: "Szanse sprzedaży", count: opportunities?.length },
    { key: "notatki", label: "Notatki" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Top navigation with Back CTA & Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => router.back()}
          className="btn"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 500,
            padding: "5px 12px",
          }}
        >
          <ArrowLeft size={14} />
          Powrót
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-mute)" }}>
          <Link
            href="/admin"
            style={{ color: "var(--text-mute)", textDecoration: "none" }}
            onMouseOver={(e) => (e.currentTarget.style.color = "var(--text)")}
            onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-mute)")}
          >
            Klienci
          </Link>
          <span style={{ opacity: 0.5 }}>›</span>
          <span style={{ color: "var(--text-dim)", fontWeight: 500 }}>
            {client.clientType === "business" && client.companyName
              ? client.companyName
              : `${client.firstName} ${client.lastName}`}
          </span>
        </div>
      </div>

      {/* ── Main panel ── */}
      <div className="panel" style={{ overflow: "visible" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "20px 24px", borderBottom: "1px solid var(--line)" }}>
          <CrmAvatar name={client.clientType === "business" && client.companyName ? client.companyName : `${client.firstName} ${client.lastName}`} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-strong)", margin: 0, lineHeight: 1.2 }}>
                {client.clientType === "business" && client.companyName
                  ? client.companyName
                  : `${client.firstName} ${client.lastName}`}
              </h1>
              {client.clientType === "business" && (
                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Firma
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, fontSize: 12, flexWrap: "wrap" }}>
              {client.city && <span className="chip">{client.city}</span>}
              {client.phone && <span style={{ color: "var(--text-mute)" }}>{client.phone}</span>}
              {client.email && <span style={{ color: "var(--text-dim)" }}>{client.email}</span>}
              {client.clientType === "business" && client.nip && (
                <span style={{ color: "var(--text-mute)", fontFamily: "monospace" }}>NIP: {client.nip}</span>
              )}
            </div>
          </div>
        </div>

        {/* Actions bar */}
        <div style={{ display: "flex", gap: 8, padding: "12px 24px", borderBottom: "1px solid var(--line)", alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => setShowNewOrderModal(true)} className="btn primary" style={{ fontSize: 12 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nowe zlecenie
          </button>

          <button onClick={() => setShowNewOppModal(true)} className="btn" style={{ fontSize: 12 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nowa szansa
          </button>

          {folderUrl ? (
            <a href={folderUrl} target="_blank" rel="noopener noreferrer" className="btn" style={{ fontSize: 12 }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
              </svg>
              Folder
            </a>
          ) : (
            <button onClick={handleCreateFolder} disabled={creatingFolder} className="btn" style={{ fontSize: 12 }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {creatingFolder ? "Tworzenie…" : "Dodaj folder"}
            </button>
          )}

          <div style={{ flex: 1 }} />

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="btn"
            style={{ fontSize: 12, color: "var(--bad)", borderColor: "oklch(0.72 0.18 25 / 0.35)" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            Usuń klienta
          </button>
        </div>

        {/* Contact + Address grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: "16px 20px",
          padding: "20px 24px",
        }}>
          {/* Business-specific: company name and NIP */}
          {client.clientType === "business" && (
            <>
              <div style={{ gridColumn: "1 / -1" }}>
                <span style={{ ...FIELD_LABEL, color: "var(--accent)", marginBottom: 8 }}>Dane firmy</span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "16px 20px" }}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <InlineEdit label="Nazwa firmy" value={client.companyName ?? ""} onSave={(v) => handleFieldSave("companyName", v)} placeholder="brak" />
                  </div>
                  <InlineEdit label="NIP" value={client.nip ?? ""} onSave={(v) => handleFieldSave("nip", v)} placeholder="brak" />
                </div>
              </div>
              <div style={{ gridColumn: "1 / -1", borderTop: "1px solid var(--line)", paddingTop: 16 }}>
                <span style={{ ...FIELD_LABEL, marginBottom: 8 }}>Osoba kontaktowa</span>
              </div>
            </>
          )}

          <InlineEdit
            label={client.clientType === "business" ? "Imię kontaktu" : "Imię"}
            value={client.firstName}
            onSave={(v) => handleFieldSave("firstName", v)}
          />
          <InlineEdit
            label={client.clientType === "business" ? "Nazwisko kontaktu" : "Nazwisko"}
            value={client.lastName}
            onSave={(v) => handleFieldSave("lastName", v)}
          />
          <InlineEdit label="Email" value={client.email ?? ""} onSave={(v) => handleFieldSave("email", v)} placeholder="brak" />
          <InlineEdit label="Telefon" value={client.phone ?? ""} onSave={(v) => handleFieldSave("phone", v)} placeholder="brak" />

          {/* NIP for individual clients only */}
          {client.clientType !== "business" && (
            <InlineEdit label="NIP" value={client.nip ?? ""} onSave={(v) => handleFieldSave("nip", v)} placeholder="brak" />
          )}

          {/* Address section */}
          <div style={{ gridColumn: "1 / -1", borderTop: "1px solid var(--line)", paddingTop: 16 }}>
            <span style={{ ...FIELD_LABEL, marginBottom: 8 }}>
              {client.clientType === "business" ? "Adres firmy" : "Adres"}
            </span>
          </div>
          <InlineEdit label="Ulica" value={client.street ?? ""} onSave={(v) => handleFieldSave("street", v)} placeholder="brak" />
          <InlineEdit label="Nr budynku" value={client.buildingNumber ?? ""} onSave={(v) => handleFieldSave("buildingNumber", v)} placeholder="brak" />
          <InlineEdit label="Nr mieszkania" value={client.apartmentNumber ?? ""} onSave={(v) => handleFieldSave("apartmentNumber", v)} placeholder="brak" />
          <InlineEdit label="Kod pocztowy" value={client.postalCode ?? ""} onSave={(v) => handleFieldSave("postalCode", v)} placeholder="brak" />
          <InlineEdit label="Miejscowość" value={client.city ?? ""} onSave={(v) => handleFieldSave("city", v)} placeholder="brak" />

          {/* Address search — spans full width */}
          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={FIELD_LABEL}>Wyszukaj adres</span>
            <AddressSearch onSelect={handleAddressSelect} />
          </div>
        </div>

        {/* Maps + distance */}
        {client.city && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 24px 16px" }}>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                [client.street, client.buildingNumber, client.postalCode, client.city].filter(Boolean).join(" ")
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 11.5, color: "var(--accent)", textDecoration: "none" }}
            >
              Google Maps ↗
            </a>
            <CityDistance city={client.city} />
          </div>
        )}

        {/* KPI stats row */}
        {(orders !== undefined || opportunities !== undefined) && (
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fill, minmax(130px, 1fr))`,
            gap: 8,
            padding: "0 24px 20px",
          }}>
            <div style={KPI_CARD}>
              <span style={{ fontSize: 10, color: "var(--text-mute)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Zlecenia</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)", lineHeight: 1 }}>{totalOrders}</span>
            </div>
            <div style={{ ...KPI_CARD, background: "var(--ok-soft)" }}>
              <span style={{ fontSize: 10, color: "var(--text-mute)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Zakończone</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: "var(--ok)", lineHeight: 1 }}>{completedOrders}</span>
            </div>
            <div style={KPI_CARD}>
              <span style={{ fontSize: 10, color: "var(--text-mute)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Szanse sprzedaży</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: "#9333ea", lineHeight: 1 }}>{totalOpportunities}</span>
            </div>
            {totalGross > 0 && (
              <div style={KPI_CARD}>
                <span style={{ fontSize: 10, color: "var(--text-mute)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Wartość zleceń</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)", fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>
                  {totalGross.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} zł
                </span>
              </div>
            )}
            {totalConfirmedOrdersGross > 0 && (
              <div style={KPI_CARD}>
                <span style={{ fontSize: 10, color: "var(--text-mute)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Wartość od „Do zamówienia”</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)", fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>
                  {totalConfirmedOrdersGross.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} zł
                </span>
              </div>
            )}
            {totalOppPrice > 0 && (
              <div style={KPI_CARD}>
                <span style={{ fontSize: 10, color: "var(--text-mute)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Wartość szans</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)", fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>
                  {totalOppPrice.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} zł
                </span>
              </div>
            )}
          </div>
        )}

        {/* Tabs bar — at bottom of main panel */}
        <div style={{ display: "flex", borderTop: "1px solid var(--line)", padding: "0 6px" }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "11px 16px",
                fontSize: 13,
                fontWeight: activeTab === tab.key ? 600 : 500,
                color: activeTab === tab.key ? "var(--accent)" : "var(--text-mute)",
                background: "none",
                border: "none",
                borderBottomStyle: "solid",
                borderBottomWidth: 2,
                borderBottomColor: activeTab === tab.key ? "var(--accent)" : "transparent",
                cursor: "pointer",
                fontFamily: "inherit",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                transition: "color 0.12s",
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

      {/* ── Tab content (separate panel) ── */}
      <div className="panel" style={{ overflow: "hidden" }}>
        {/* Tab: Zlecenia */}
        {activeTab === "zlecenia" && (
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
                      <TableCell key={j}>
                        <div style={{ height: 14, borderRadius: 4, background: "var(--panel-3)", animation: "pulse 1.5s ease-in-out infinite" }} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

                {orders !== undefined && orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <CrmEmptyState message="Brak zleceń dla tego klienta." />
                    </TableCell>
                  </TableRow>
                )}

                {orders?.map((order) => {
                  const isCompleted = order.status === "completed";
                  const hasFinalInvoice = (order.fakturownia?.invoices ?? []).some((inv) => inv.kind === "final");
                  return (
                    <TableRow
                      key={order._id}
                      style={isCompleted ? { background: "var(--ok-soft)", cursor: "pointer" } : { cursor: "pointer" }}
                      onClick={() => router.push(`/admin/klient/${id}/zlecenie/${order._id}`)}
                    >
                      <TableCell>
                        <div className="strong" style={{ fontWeight: 500, fontSize: 12.5 }}>
                          {order.name ?? <span className="mute">Zlecenie z {fmtDate(order._creationTime)}</span>}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
                          {order.customText && (
                            <span className="chip-custom">{order.customText}</span>
                          )}
                          {hasFinalInvoice && (
                            <span className="chip">Faktura wystawiona</span>
                          )}
                        </div>
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
                          {(order as { projectStartDate?: number }).projectStartDate ? (
                            <>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <CalendarDays size={11} style={{ color: "var(--text-mute)" }} />
                                Start: {fmtDate((order as { projectStartDate?: number }).projectStartDate!)}
                              </div>
                              {(order as { installationStartDate?: number }).installationStartDate && (
                                <div className="mute" style={{ fontSize: 10.5, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                                  <Clock size={10} />
                                  Montaż: {fmtDate((order as { installationStartDate?: number }).installationStartDate!)}
                                </div>
                              )}
                              {(order as { projectEndDate?: number }).projectEndDate && (
                                <div className="mute" style={{ fontSize: 10.5, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                                  <Clock size={10} />
                                  Koniec: {fmtDate((order as { projectEndDate?: number }).projectEndDate!)}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="mute">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="mono tnum" style={{ textAlign: "right" }}>
                        {(order as { totalGross?: number }).totalGross != null
                          ? `${(order as { totalGross?: number }).totalGross!.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
                          : <span className="mute">—</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableRoot>
        )}

        {/* Tab: Szanse */}
        {activeTab === "szanse" && (
          <TableRoot>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Nazwa / Inwestycja</TableHeaderCell>
                  <TableHeaderCell>Etap</TableHeaderCell>
                  <TableHeaderCell>Usługi</TableHeaderCell>
                  <TableHeaderCell>Data utworzenia</TableHeaderCell>
                  <TableHeaderCell style={{ textAlign: "right" }}>Wartość brutto</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {opportunities === undefined && Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}>
                        <div style={{ height: 14, borderRadius: 4, background: "var(--panel-3)", animation: "pulse 1.5s ease-in-out infinite" }} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

                {opportunities !== undefined && opportunities.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <CrmEmptyState message="Brak szans sprzedaży dla tego klienta." />
                    </TableCell>
                  </TableRow>
                )}

                {opportunities?.map((opp) => {
                  return (
                    <TableRow
                      key={opp._id}
                      style={{ cursor: "pointer" }}
                      onClick={() => router.push(`/admin/szansa/${opp._id}`)}
                    >
                      <TableCell>
                        <div className="strong" style={{ fontWeight: 500, fontSize: 12.5 }}>
                          {opp.customText ?? <span className="mute">Szansa z {fmtDate(opp._creationTime)}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <StatusPill status={opp.stage ?? "lead"} />
                          {opp.archived && <StatusPill status="archived" />}
                        </div>
                      </TableCell>
                      <TableCell>
                        {opp.services && opp.services.length > 0
                          ? <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                              {opp.services.map((s) => <span key={s} className="chip">{s}</span>)}
                            </div>
                          : <span className="mute">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="mono" style={{ fontSize: 11 }}>
                          {fmtDate(opp._creationTime)}
                        </div>
                      </TableCell>
                      <TableCell className="mono tnum" style={{ textAlign: "right" }}>
                        {opp.price != null
                          ? `${opp.price.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
                          : <span className="mute">—</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableRoot>
        )}

        {/* Tab: Notatki */}
        {activeTab === "notatki" && (
          <div style={{ padding: 16 }}>
            <Notes clientId={clientId} />
          </div>
        )}
      </div>

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

      {/* New Opportunity Modal */}
      {showNewOppModal && (
        <NewOpportunityModal
          onClose={() => setShowNewOppModal(false)}
          initialClient={{
            id: client._id,
            name: client.clientType === "business" && client.companyName ? client.companyName : `${client.firstName} ${client.lastName}`,
            firstName: client.firstName,
            lastName: client.lastName,
            email: client.email,
            phone: client.phone,
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
