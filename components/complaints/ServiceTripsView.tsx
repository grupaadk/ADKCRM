"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Plus, Calendar, Package, ChevronRight, GripVertical, X, Lock, AlertTriangle } from "lucide-react";
import NewServiceTripModal from "./NewServiceTripModal";

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getClientName(c: {
  customClientName?: string;
  client?: { firstName?: string; lastName?: string; companyName?: string } | null;
  order?: { name?: string } | null;
}) {
  return (
    c.customClientName ||
    [c.client?.firstName, c.client?.lastName].filter(Boolean).join(" ") ||
    c.client?.companyName ||
    c.order?.name ||
    "Reklamacja (wpisana ręcznie)"
  );
}

type ComplaintCard = {
  _id: Id<"complaints">;
  customClientName?: string;
  customClientAddress?: string;
  customClientPhone?: string;
  clientDescription?: string;
  description?: string;
  serviceDate?: number;
  startDate: number;
  serviceTripPosition?: number;
  status: string;
  client?: {
    firstName?: string;
    lastName?: string;
    companyName?: string;
    phone?: string;
    street?: string;
    buildingNumber?: string;
    city?: string;
    address?: string;
  } | null;
  order?: {
    name?: string;
    investmentStreet?: string;
    investmentBuildingNumber?: string;
    investmentCity?: string;
    investmentApartmentNumber?: string;
  } | null;
};

function getAddress(c: ComplaintCard): string {
  if (c.customClientAddress) return c.customClientAddress;
  if (c.order) {
    const street = [c.order.investmentStreet, c.order.investmentBuildingNumber]
      .filter(Boolean).join(" ");
    const apt = c.order.investmentApartmentNumber ? `/${c.order.investmentApartmentNumber}` : "";
    const city = c.order.investmentCity ?? "";
    const full = `${street}${apt}`.trim();
    return [full, city].filter(Boolean).join(", ");
  }
  if (c.client) {
    const street = [c.client.street, c.client.buildingNumber].filter(Boolean).join(" ");
    return [street, c.client.city].filter(Boolean).join(", ") || c.client.address || "";
  }
  return "";
}

function getPhone(c: ComplaintCard): string {
  return c.customClientPhone || c.client?.phone || "";
}

function getTooltipText(c: ComplaintCard): string {
  const parts: string[] = [];
  const name = getClientName(c);
  if (name) parts.push(`👤 ${name}`);

  const addr = getAddress(c);
  if (addr) parts.push(`📍 ${addr}`);

  const phone = getPhone(c);
  if (phone) parts.push(`📞 ${phone}`);

  if (c.order?.name) parts.push(`📋 Zlecenie: ${c.order.name}`);

  if (c.description) parts.push(`\n📝 Opis usterki:\n${c.description}`);
  if (c.clientDescription) parts.push(`\n💬 Opis klienta:\n${c.clientDescription}`);

  if (c.serviceDate) {
    parts.push(`\n🗓 Data serwisu: ${formatDate(c.serviceDate)}`);
  } else if (c.startDate) {
    parts.push(`\n📅 Data zgłoszenia: ${formatDate(c.startDate)}`);
  }

  return parts.join("\n").trim();
}

type Trip = {
  _id: Id<"serviceTrips">;
  name: string;
  date: number;
  status: "open" | "closed";
  complaintCount: number;
};

export default function ServiceTripsView() {
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<Id<"serviceTrips"> | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [dragOverTrip, setDragOverTrip] = useState(false);
  const [draggingId, setDraggingId] = useState<Id<"complaints"> | null>(null);
  const [draggingFromTrip, setDraggingFromTrip] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragItem = useRef<number | null>(null);

  const trips = useQuery(api.serviceTrips.list);
  const tripDetail = useQuery(
    api.serviceTrips.getWithComplaints,
    selectedTripId ? { tripId: selectedTripId } : "skip",
  );
  const unassigned = useQuery(api.serviceTrips.getUnassignedComplaints);

  const assignComplaint = useMutation(api.serviceTrips.assignComplaint);
  const unassignComplaint = useMutation(api.serviceTrips.unassignComplaint);
  const closeTrip = useMutation(api.serviceTrips.close);
  const reorder = useMutation(api.serviceTrips.reorder);

  const selectedTrip = trips?.find((t) => t._id === selectedTripId);

  // ── Drag from pool → trip ──────────────────────────────────────────────
  const handlePoolDragStart = useCallback((id: Id<"complaints">) => {
    setDraggingId(id);
    setDraggingFromTrip(false);
  }, []);

  const handleTripDropZoneDrop = useCallback(async () => {
    if (!draggingId || !selectedTripId || draggingFromTrip) return;
    try {
      await assignComplaint({ complaintId: draggingId, tripId: selectedTripId });
    } catch {
      // ignore
    }
    setDraggingId(null);
    setDragOverTrip(false);
  }, [draggingId, selectedTripId, assignComplaint, draggingFromTrip]);

  // ── Drag reorder within trip ───────────────────────────────────────────
  const handleTripItemDragStart = useCallback(
    (index: number, id: Id<"complaints">) => {
      dragItem.current = index;
      setDraggingId(id);
      setDraggingFromTrip(true);
    },
    [],
  );

  const handleTripItemDrop = useCallback(
    async (dropIndex: number) => {
      if (dragItem.current === null || !tripDetail || !draggingFromTrip) return;
      const items = [...(tripDetail.complaints ?? [])];
      const [moved] = items.splice(dragItem.current, 1);
      items.splice(dropIndex, 0, moved);
      const orderedIds = items.map((c) => c._id);
      dragItem.current = null;
      setDragOverIndex(null);
      setDraggingId(null);
      try {
        await reorder({ tripId: tripDetail._id, orderedIds });
      } catch {
        // ignore
      }
    },
    [tripDetail, draggingFromTrip, reorder],
  );

  const handleCloseTrip = async () => {
    if (!selectedTripId) return;
    try {
      await closeTrip({ tripId: selectedTripId });
      setConfirmClose(false);
    } catch {
      // ignore
    }
  };

  // ── UI ────────────────────────────────────────────────────────────────

  const openTrips = trips?.filter((t) => t.status === "open") ?? [];
  const closedTrips = trips?.filter((t) => t.status === "closed") ?? [];

  return (
    <div style={{ display: "flex", gap: 0, height: "calc(100vh - 220px)", minHeight: 500 }}>

      {/* ─── LEFT: Trip list ─────────────────────────────────────── */}
      <div
        style={{
          width: 280,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid var(--line)",
          background: "var(--panel)",
          borderRadius: "12px 0 0 12px",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-strong)" }}>Wyjazdy</span>
          <button
            onClick={() => setShowNewModal(true)}
            className="btn primary"
            style={{ fontSize: 11, padding: "5px 10px", display: "flex", alignItems: "center", gap: 4 }}
          >
            <Plus size={12} /> Nowy
          </button>
        </div>

        {/* Trip list scroll */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {trips === undefined && (
            <p style={{ textAlign: "center", color: "var(--text-mute)", fontSize: 12, padding: 20 }}>Ładowanie…</p>
          )}

          {/* Open trips */}
          {openTrips.length === 0 && closedTrips.length === 0 && trips !== undefined && (
            <div style={{ padding: "24px 14px", textAlign: "center" }}>
              <Calendar size={28} style={{ color: "var(--text-mute)", marginBottom: 8 }} />
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-mute)" }}>Brak wyjazdów serwisowych</p>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-mute)" }}>Kliknij „Nowy" aby utworzyć</p>
            </div>
          )}

          {openTrips.map((trip) => (
            <TripListItem
              key={trip._id}
              trip={trip}
              selected={selectedTripId === trip._id}
              onClick={() => setSelectedTripId(trip._id)}
            />
          ))}

          {closedTrips.length > 0 && (
            <>
              <div style={{ padding: "8px 14px 4px", fontSize: 10.5, fontWeight: 600, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Zamknięte
              </div>
              {closedTrips.map((trip) => (
                <TripListItem
                  key={trip._id}
                  trip={trip}
                  selected={selectedTripId === trip._id}
                  onClick={() => setSelectedTripId(trip._id)}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* ─── RIGHT: Detail ────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "var(--panel-2)", borderRadius: "0 12px 12px 0", overflow: "hidden" }}>
        {!selectedTripId ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-mute)" }}>
            <Package size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>Wybierz wyjazd</p>
            <p style={{ margin: "4px 0 0", fontSize: 12 }}>lub utwórz nowy klikając „Nowy"</p>
          </div>
        ) : tripDetail === undefined ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "var(--text-mute)", fontSize: 13 }}>Ładowanie…</p>
          </div>
        ) : tripDetail === null ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "var(--text-mute)", fontSize: 13 }}>Nie znaleziono wyjazdu.</p>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Trip Header */}
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--line)",
              background: "var(--panel)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexShrink: 0,
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-strong)" }}>
                    {tripDetail.name}
                  </h2>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12,
                    background: tripDetail.status === "open" ? "var(--accent-soft)" : "var(--panel-3)",
                    color: tripDetail.status === "open" ? "var(--accent)" : "var(--text-mute)",
                    border: tripDetail.status === "open" ? "1px solid var(--accent)" : "1px solid var(--line)",
                  }}>
                    {tripDetail.status === "open" ? "Otwarty" : "Zamknięty"}
                  </span>
                </div>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-mute)", display: "flex", alignItems: "center", gap: 5 }}>
                  <Calendar size={12} /> {formatDate(tripDetail.date)}
                  <span style={{ margin: "0 4px" }}>·</span>
                  {tripDetail.complaints.length} {tripDetail.complaints.length === 1 ? "reklamacja" : "reklamacji"}
                </p>
              </div>

              {tripDetail.status === "open" && (
                confirmClose ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fef3c7", padding: "8px 12px", borderRadius: 8, border: "1px solid #fbbf24" }}>
                    <AlertTriangle size={14} style={{ color: "#92400e" }} />
                    <span style={{ fontSize: 12, color: "#92400e", fontWeight: 500 }}>
                      Reklamacje zostaną zarchiwizowane.
                    </span>
                    <button onClick={handleCloseTrip} style={{ fontSize: 12, padding: "3px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                      Potwierdź
                    </button>
                    <button onClick={() => setConfirmClose(false)} style={{ fontSize: 12, padding: "3px 10px", background: "none", border: "1px solid var(--line)", borderRadius: 6, cursor: "pointer" }}>
                      Anuluj
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmClose(true)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      fontSize: 12, padding: "7px 14px",
                      background: "var(--panel-3)", border: "1px solid var(--line)",
                      borderRadius: 8, cursor: "pointer", color: "var(--text-mute)",
                      fontFamily: "inherit", transition: "all 0.15s",
                    }}
                  >
                    <Lock size={12} /> Zamknij wyjazd
                  </button>
                )
              )}
            </div>

            {/* Two-column: trip complaints + pool */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

              {/* Complaints in trip */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", borderRight: "1px solid var(--line)" }}>
                <div style={{ padding: "10px 16px 8px", fontSize: 11.5, fontWeight: 700, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
                  W tym wyjeździe ({tripDetail.complaints.length})
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!draggingFromTrip) setDragOverTrip(true);
                  }}
                  onDragLeave={() => setDragOverTrip(false)}
                  onDrop={handleTripDropZoneDrop}
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "8px 10px",
                    background: dragOverTrip ? "var(--accent-soft)" : "transparent",
                    transition: "background 0.15s",
                    minHeight: 80,
                  }}
                >
                  {tripDetail.complaints.length === 0 && !dragOverTrip && (
                    <div style={{ padding: "24px 10px", textAlign: "center", border: "2px dashed var(--line)", borderRadius: 10, color: "var(--text-mute)" }}>
                      <p style={{ margin: 0, fontSize: 12 }}>Przeciągnij reklamacje z listy obok</p>
                    </div>
                  )}

                  {tripDetail.complaints.map((c, index) => (
                    <div
                      key={c._id}
                      draggable={tripDetail.status === "open"}
                      onDragStart={() => handleTripItemDragStart(index, c._id)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (draggingFromTrip) setDragOverIndex(index);
                      }}
                      onDrop={() => handleTripItemDrop(index)}
                      onDragEnd={() => { setDragOverIndex(null); setDraggingId(null); }}
                      title={getTooltipText(c)}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        padding: "10px 10px 10px 6px",
                        marginBottom: 6,
                        borderRadius: 10,
                        background: "var(--panel)",
                        border: dragOverIndex === index ? "2px solid var(--accent)" : "1px solid var(--line)",
                        opacity: draggingId === c._id && draggingFromTrip ? 0.4 : 1,
                        cursor: tripDetail.status === "open" ? "grab" : "default",
                        transition: "border-color 0.12s, opacity 0.12s",
                      }}
                    >
                      {tripDetail.status === "open" && (
                        <GripVertical size={14} style={{ color: "var(--text-mute)", marginTop: 2, flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {getClientName(c)}
                        </div>
                        {(() => { const addr = getAddress(c); return addr ? (
                          <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            📍 {addr}
                          </div>
                        ) : null; })()}
                        {c.serviceDate && (
                          <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 2 }}>
                            🗓 {formatDate(c.serviceDate)}
                          </div>
                        )}
                        {(c.description || c.clientDescription) && (
                          <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {c.description || c.clientDescription}
                          </div>
                        )}
                      </div>
                      {tripDetail.status === "open" && (
                        <button
                          onClick={() => unassignComplaint({ complaintId: c._id })}
                          title="Usuń z wyjazdu"
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: "var(--text-mute)", padding: 2, borderRadius: 4,
                            display: "flex", alignItems: "center",
                            flexShrink: 0,
                          }}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Pool: unassigned complaints */}
              {tripDetail.status === "open" && (
                <div style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ padding: "10px 16px 8px", fontSize: 11.5, fontWeight: 700, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--line)", flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
                    Pula reklamacji
                    {unassigned !== undefined && (
                      <span style={{ fontSize: 10, background: "var(--line)", borderRadius: 10, padding: "1px 6px", color: "var(--text-mute)" }}>
                        {unassigned.length}
                      </span>
                    )}
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
                    {unassigned === undefined && (
                      <p style={{ textAlign: "center", color: "var(--text-mute)", fontSize: 12, padding: 20 }}>Ładowanie…</p>
                    )}
                    {unassigned?.length === 0 && (
                      <div style={{ padding: "24px 10px", textAlign: "center" }}>
                        <p style={{ margin: 0, fontSize: 12, color: "var(--text-mute)" }}>Brak dostępnych reklamacji</p>
                      </div>
                    )}
                    {unassigned?.map((c) => (
                      <div
                        key={c._id}
                        draggable
                        onDragStart={() => handlePoolDragStart(c._id)}
                        onDragEnd={() => setDraggingId(null)}
                        title={getTooltipText(c)}
                        style={{
                          padding: "9px 10px",
                          marginBottom: 6,
                          borderRadius: 10,
                          background: "var(--panel)",
                          border: "1px solid var(--line)",
                          cursor: "grab",
                          opacity: draggingId === c._id ? 0.4 : 1,
                          transition: "opacity 0.12s",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 12.5, color: "var(--text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {getClientName(c)}
                            </div>
                            {(() => { const addr = getAddress(c); return addr ? (
                              <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                📍 {addr}
                              </div>
                            ) : null; })()}
                            {(() => { const phone = getPhone(c); return phone ? (
                              <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 1 }}>
                                📞 {phone}
                              </div>
                            ) : null; })()}
                            {c.serviceDate ? (
                              <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 2 }}>
                                🗓 Serwis: {formatDate(c.serviceDate)}
                              </div>
                            ) : (
                              <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 2 }}>
                                📅 Zgłoszenie: {formatDate(c.startDate)}
                              </div>
                            )}
                            {(c.description || c.clientDescription) && (
                              <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", borderTop: "1px solid var(--line)", paddingTop: 3 }}>
                                {c.description || c.clientDescription}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => assignComplaint({ complaintId: c._id, tripId: selectedTripId! })}
                            title="Dodaj do wyjazdu"
                            style={{
                              flexShrink: 0,
                              display: "flex", alignItems: "center", gap: 4,
                              fontSize: 11, padding: "3px 8px",
                              background: "var(--accent-soft)", border: "1px solid var(--accent)",
                              borderRadius: 6, cursor: "pointer", color: "var(--accent)",
                              fontFamily: "inherit", whiteSpace: "nowrap",
                            }}
                          >
                            <ChevronRight size={11} /> Dodaj
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* New trip modal */}
      {showNewModal && (
        <NewServiceTripModal
          onClose={() => setShowNewModal(false)}
          onCreated={() => setShowNewModal(false)}
        />
      )}
    </div>
  );
}

// ─── Trip list item ────────────────────────────────────────────────────────

function TripListItem({ trip, selected, onClick }: { trip: Trip; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        padding: "10px 14px",
        background: selected ? "var(--accent-soft)" : "transparent",
        border: "none",
        borderLeft: selected ? "3px solid var(--accent)" : "3px solid transparent",
        cursor: "pointer",
        textAlign: "left",
        gap: 3,
        transition: "background 0.15s",
        opacity: trip.status === "closed" ? 0.65 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: selected ? "var(--accent)" : "var(--text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {trip.name}
        </span>
        {trip.status === "closed" && <Lock size={11} style={{ color: "var(--text-mute)", flexShrink: 0 }} />}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-mute)", display: "flex", gap: 8, alignItems: "center" }}>
        <span><Calendar size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />{formatDate(trip.date)}</span>
        <span>{trip.complaintCount} rek.</span>
      </div>
    </button>
  );
}
