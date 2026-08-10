"use client";

import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type Props = {
  onClose: () => void;
  onCreated?: (id: Id<"complaints">) => void;
  defaultClientId?: Id<"clients">;
  defaultOrderId?: Id<"orders">;
};

const FULL_HOURS = [
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00",
  "20:00", "21:00", "22:00",
];

export default function NewComplaintModal({ onClose, onCreated, defaultClientId, defaultOrderId }: Props) {
  const [visible, setVisible] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<Id<"clients"> | null>(defaultClientId ?? null);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<Id<"orders"> | null>(defaultOrderId ?? null);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [serviceDate, setServiceDate] = useState("");
  const [serviceTimeStart, setServiceTimeStart] = useState("");
  const [serviceTimeEnd, setServiceTimeEnd] = useState("");
  const [clientDescription, setClientDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [installationTeamId, setInstallationTeamId] = useState<Id<"installationTeams"> | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientType, setNewClientType] = useState<"individual" | "business">("individual");
  const [newClientFirstName, setNewClientFirstName] = useState("");
  const [newClientLastName, setNewClientLastName] = useState("");
  const [newClientCompanyName, setNewClientCompanyName] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

  const me = useQuery(api.users.me);
  const users = useQuery(api.users.listAllActive);
  const installationTeams = useQuery(api.installationTeams.listActive) ?? [];
  const searchResults = useQuery(
    api.clients.search,
    clientSearch.trim().length >= 2 ? { searchTerm: clientSearch } : "skip",
  );
  // Default client query if passed via props
  const defaultClient = useQuery(
    api.clients.getById,
    defaultClientId ? { clientId: defaultClientId } : "skip",
  );

  useEffect(() => {
    if (defaultClient && !selectedClientName) {
      setSelectedClientName(
        [defaultClient.firstName, defaultClient.lastName].filter(Boolean).join(" ") || defaultClient.companyName || String(defaultClient._id),
      );
    }
  }, [defaultClient, selectedClientName]);

  // Orders for selected client
  const clientOrders = useQuery(
    api.orders.listByClient,
    selectedClientId ? { clientId: selectedClientId } : "skip",
  );

  const createComplaint = useMutation(api.complaints.create);
  const createClient = useMutation(api.clients.create);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const selectClient = useCallback((client: { _id: Id<"clients">; firstName?: string; lastName?: string; companyName?: string }) => {
    setSelectedClientId(client._id);
    setSelectedClientName(
      [client.firstName, client.lastName].filter(Boolean).join(" ") || client.companyName || String(client._id),
    );
    setClientSearch("");
    setSelectedOrderId(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedClientId) { setError("Wybierz klienta."); return; }
    setSaving(true);
    setError(null);
    try {
      let serviceDateTs: number | undefined;
      let serviceDateEndTs: number | undefined;
      if (serviceDate) {
        const base = new Date(serviceDate);
        if (serviceTimeStart) {
          const [h, m] = serviceTimeStart.split(":").map(Number);
          base.setHours(h, m, 0, 0);
        } else {
          base.setHours(0, 0, 0, 0);
        }
        serviceDateTs = base.getTime();
        if (serviceTimeEnd) {
          const end = new Date(serviceDate);
          const [h, m] = serviceTimeEnd.split(":").map(Number);
          end.setHours(h, m, 0, 0);
          serviceDateEndTs = end.getTime();
        }
      }
      const id = await createComplaint({
        clientId: selectedClientId,
        orderId: selectedOrderId ?? undefined,
        startDate: new Date(startDate).getTime(),
        serviceDate: serviceDateTs,
        serviceDateEnd: serviceDateEndTs,
        clientDescription: clientDescription.trim() || undefined,
        assignedTo: assignedTo || undefined,
        installationTeamId: installationTeamId || undefined,
        createdBy: me?.displayName ?? me?.login ?? "Nieznany",
      });
      onCreated?.(id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu.");
    } finally {
      setSaving(false);
    }
  }, [selectedClientId, selectedOrderId, startDate, serviceDate, serviceTimeStart, serviceTimeEnd, clientDescription, assignedTo, installationTeamId, me, createComplaint, onCreated, onClose]);

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 700,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: visible ? 1 : 0,
    transition: "opacity 0.2s",
  };

  const modalStyle: React.CSSProperties = {
    background: "var(--panel, #fff)",
    borderRadius: 12,
    border: "1px solid var(--line)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.22)",
    width: 480,
    maxWidth: "calc(100vw - 32px)",
    display: "flex",
    flexDirection: "column",
    transform: visible ? "scale(1) translateY(0)" : "scale(0.96) translateY(8px)",
    transition: "transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
    maxHeight: "90vh",
    overflow: "hidden",
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid var(--line)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)" }}>
            Nowa reklamacja
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-mute)",
              padding: 4,
              display: "flex",
              borderRadius: 4,
            }}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 18px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Klient */}
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-mute)", display: "block", marginBottom: 5 }}>
              Klient <span style={{ color: "#ef4444" }}>*</span>
            </label>
            {selectedClientId ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "7px 10px",
                  borderRadius: 7,
                  border: "1px solid var(--line)",
                  background: "var(--panel-2)",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{selectedClientName}</span>
                {!defaultClientId && (
                  <button
                    onClick={() => { setSelectedClientId(null); setSelectedClientName(""); setSelectedOrderId(null); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-mute)", fontSize: 11 }}
                  >
                    Zmień
                  </button>
                )}
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  placeholder="Wpisz nazwisko lub firmę klienta…"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  style={{
                    width: "100%",
                    fontSize: 12.5,
                    padding: "7px 10px",
                    borderRadius: 7,
                    border: "1px solid var(--line)",
                    background: "var(--panel-2)",
                    color: "var(--text)",
                    fontFamily: "inherit",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                {clientSearch.trim().length >= 2 && searchResults && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      zIndex: 10,
                      background: "var(--panel, #fff)",
                      border: "1px solid var(--line)",
                      borderRadius: 7,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                      marginTop: 3,
                      overflow: "hidden",
                    }}
                  >
                    {searchResults.length > 0 ? (
                      searchResults.map((client) => {
                        const name = [client.firstName, client.lastName].filter(Boolean).join(" ") || client.companyName || String(client._id);
                        return (
                          <button
                            key={client._id}
                            onClick={() => selectClient(client)}
                            style={{
                              display: "block",
                              width: "100%",
                              textAlign: "left",
                              padding: "8px 12px",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: 12.5,
                              color: "var(--text)",
                              fontFamily: "inherit",
                              borderBottom: "1px solid var(--line)",
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--panel-2)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                          >
                            {name}
                            {client.companyName && [client.firstName, client.lastName].filter(Boolean).length > 0 && (
                              <span style={{ marginLeft: 6, fontSize: 11, color: "var(--text-mute)" }}>
                                ({client.companyName})
                              </span>
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <div style={{ padding: "12px", textAlign: "center" }}>
                        <p style={{ fontSize: 11, color: "var(--text-mute)", marginBottom: 8 }}>Nie znaleziono klienta.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingClient(true);
                            setClientSearch("");
                          }}
                          style={{
                            fontSize: 11.5,
                            fontWeight: 600,
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "1px solid var(--accent)",
                            color: "var(--accent)",
                            background: "var(--accent-soft)",
                            cursor: "pointer",
                          }}
                        >
                          Dodaj nowego klienta
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Formularz tworzenia nowego klienta */}
          {isCreatingClient && !selectedClientId && (
            <div style={{ padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--panel-2)", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>Nowy klient</span>
                <button
                  type="button"
                  onClick={() => setIsCreatingClient(false)}
                  style={{ background: "none", border: "none", fontSize: 11, color: "var(--text-mute)", cursor: "pointer" }}
                >
                  Anuluj
                </button>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <label style={{ fontSize: 11.5, display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="radio" checked={newClientType === "individual"} onChange={() => setNewClientType("individual")} />
                  Osoba fizyczna
                </label>
                <label style={{ fontSize: 11.5, display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="radio" checked={newClientType === "business"} onChange={() => setNewClientType("business")} />
                  Firma
                </label>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  type="text"
                  placeholder="Imię"
                  value={newClientFirstName}
                  onChange={(e) => setNewClientFirstName(e.target.value)}
                  style={{ flex: 1, padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid var(--line)", outline: "none" }}
                />
                <input
                  type="text"
                  placeholder="Nazwisko"
                  value={newClientLastName}
                  onChange={(e) => setNewClientLastName(e.target.value)}
                  style={{ flex: 1, padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid var(--line)", outline: "none" }}
                />
              </div>
              {newClientType === "business" && (
                <input
                  type="text"
                  placeholder="Nazwa firmy"
                  value={newClientCompanyName}
                  onChange={(e) => setNewClientCompanyName(e.target.value)}
                  style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid var(--line)", outline: "none" }}
                />
              )}
              <button
                type="button"
                disabled={creatingClient || (!newClientFirstName && !newClientLastName && !newClientCompanyName)}
                onClick={async () => {
                  setCreatingClient(true);
                  setError(null);
                  try {
                    const clientId = await createClient({
                      clientType: newClientType,
                      firstName: newClientFirstName.trim(),
                      lastName: newClientLastName.trim(),
                      companyName: newClientType === "business" ? newClientCompanyName.trim() : undefined,
                    });
                    const name = [newClientFirstName, newClientLastName].filter(Boolean).join(" ") || newClientCompanyName;
                    setSelectedClientId(clientId);
                    setSelectedClientName(name);
                    setIsCreatingClient(false);
                    setClientSearch("");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Błąd tworzenia klienta");
                  } finally {
                    setCreatingClient(false);
                  }
                }}
                className="btn"
                style={{ fontSize: 12, padding: "8px", marginTop: 4, width: "100%" }}
              >
                {creatingClient ? "Tworzenie..." : "Zapisz i wybierz"}
              </button>
            </div>
          )}

          {/* Zlecenie (opcjonalne) - ukryte jeśli przekazano defaultOrderId */}
          {selectedClientId && !defaultOrderId && (
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-mute)", display: "block", marginBottom: 5 }}>
                Dotyczy zlecenia <span style={{ fontSize: 10.5, fontWeight: 400 }}>(opcjonalne)</span>
              </label>
              <select
                value={selectedOrderId ?? ""}
                onChange={(e) => setSelectedOrderId(e.target.value ? (e.target.value as Id<"orders">) : null)}
                style={{
                  width: "100%",
                  fontSize: 12.5,
                  padding: "7px 10px",
                  borderRadius: 7,
                  border: "1px solid var(--line)",
                  background: "var(--panel-2)",
                  color: "var(--text)",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              >
                <option value="">— Brak zlecenia (reklamacja ogólna) —</option>
                {clientOrders?.map((order) => {
                  const dateStr = new Date(order._creationTime).toLocaleDateString("pl-PL");
                  const custom = order.customText ? ` [${order.customText}]` : "";
                  const total = order.totals?.totalGross ? ` (${order.totals.totalGross.toLocaleString("pl-PL")} zł)` : "";
                  return (
                    <option key={order._id} value={order._id}>
                      {order.name ?? `Zlecenie z ${dateStr}`}{custom} — z dnia {dateStr}{total}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Data reklamacji */}
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-mute)", display: "block", marginBottom: 5 }}>
                Data reklamacji <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: "100%",
                  fontSize: 12.5,
                  padding: "7px 10px",
                  borderRadius: 7,
                  border: "1px solid var(--line)",
                  background: "var(--panel-2)",
                  color: "var(--text)",
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            {/* Data serwisu */}
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-mute)", display: "block", marginBottom: 5 }}>
                Data serwisu (opcjonalnie)
              </label>
              <input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                style={{
                  width: "100%",
                  fontSize: 12.5,
                  padding: "7px 10px",
                  borderRadius: 7,
                  border: "1px solid var(--line)",
                  background: "var(--panel-2)",
                  color: "var(--text)",
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Godziny serwisu (pełne godziny) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-mute)", display: "block", marginBottom: 5 }}>
                Godzina serwisu od
              </label>
              <select
                value={serviceTimeStart}
                onChange={(e) => setServiceTimeStart(e.target.value)}
                disabled={!serviceDate}
                style={{
                  width: "100%",
                  fontSize: 12.5,
                  padding: "7px 10px",
                  borderRadius: 7,
                  border: "1px solid var(--line)",
                  background: serviceDate ? "var(--panel-2)" : "var(--panel)",
                  color: "var(--text)",
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                  opacity: serviceDate ? 1 : 0.5,
                }}
              >
                <option value="">— Pełna godzina —</option>
                {FULL_HOURS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-mute)", display: "block", marginBottom: 5 }}>
                Godzina serwisu do
              </label>
              <select
                value={serviceTimeEnd}
                onChange={(e) => setServiceTimeEnd(e.target.value)}
                disabled={!serviceDate}
                style={{
                  width: "100%",
                  fontSize: 12.5,
                  padding: "7px 10px",
                  borderRadius: 7,
                  border: "1px solid var(--line)",
                  background: serviceDate ? "var(--panel-2)" : "var(--panel)",
                  color: "var(--text)",
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                  opacity: serviceDate ? 1 : 0.5,
                }}
              >
                <option value="">— Pełna godzina —</option>
                {FULL_HOURS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Uwagi klienta */}
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-mute)", display: "block", marginBottom: 5 }}>
              Uwagi klienta
            </label>
            <textarea
              rows={3}
              placeholder="Co klient zgłasza?"
              value={clientDescription}
              onChange={(e) => setClientDescription(e.target.value)}
              style={{
                width: "100%",
                fontSize: 12.5,
                padding: "7px 10px",
                borderRadius: 7,
                border: "1px solid var(--line)",
                background: "var(--panel-2)",
                color: "var(--text)",
                fontFamily: "inherit",
                resize: "vertical",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Przypisany do */}
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-mute)", display: "block", marginBottom: 5 }}>
              Przypisany do
            </label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              style={{
                width: "100%",
                fontSize: 12.5,
                padding: "7px 10px",
                borderRadius: 7,
                border: "1px solid var(--line)",
                background: "var(--panel-2)",
                color: "var(--text)",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            >
              <option value="">— Nieprzypisany —</option>
              {users?.map((u) => (
                <option key={u._id} value={u.displayName ?? u.login ?? ""}>
                  {u.displayName ?? u.login}
                </option>
              ))}
            </select>
          </div>

          {/* Ekipa montażowa */}
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-mute)", display: "block", marginBottom: 5 }}>
              Ekipa montażowa (opcjonalnie)
            </label>
            <select
              value={installationTeamId}
              onChange={(e) => setInstallationTeamId(e.target.value as Id<"installationTeams"> | "")}
              style={{
                width: "100%",
                fontSize: 12.5,
                padding: "7px 10px",
                borderRadius: 7,
                border: "1px solid var(--line)",
                background: "var(--panel-2)",
                color: "var(--text)",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            >
              <option value="">— Brak przypisanej ekipy —</option>
              {installationTeams.map((t) => (
                <option key={t._id} value={t._id}>
                  🛠️ {t.name}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p style={{ margin: 0, fontSize: 12, color: "#dc2626", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, padding: "6px 10px" }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "12px 18px",
            borderTop: "1px solid var(--line)",
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "1px solid var(--line)",
              borderRadius: 7,
              cursor: "pointer",
              fontSize: 12.5,
              padding: "7px 16px",
              color: "var(--text-mute)",
              fontFamily: "inherit",
            }}
          >
            Anuluj
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !selectedClientId}
            className="btn"
            style={{ fontSize: 12.5, padding: "7px 18px" }}
          >
            {saving ? "Zapisywanie…" : "Dodaj reklamację"}
          </button>
        </div>
      </div>
    </div>
  );
}
