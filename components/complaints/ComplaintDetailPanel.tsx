"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { createPortal } from "react-dom";
import ComplaintPhotoSection from "@/app/admin/klient/[id]/zlecenie/[orderId]/ComplaintPhotoSection";
import { Search, UserPlus, X, CheckCircle2 } from "lucide-react";

type Status = "nowa" | "w_toku" | "rozwiazana" | "zamknieta";

const STATUS_LABELS: Record<Status, string> = {
  nowa: "Nowa",
  w_toku: "W toku",
  rozwiazana: "Rozwiązana",
  zamknieta: "Zamknięta",
};

const STATUS_COLORS: Record<Status, { bg: string; color: string; border: string }> = {
  nowa: { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  w_toku: { bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
  rozwiazana: { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  zamknieta: { bg: "#f8fafc", color: "#64748b", border: "#e2e8f0" },
};

const FULL_HOURS = [
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00",
  "20:00", "21:00", "22:00",
];

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(ts: number) {
  return new Date(ts).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = {
  complaintId: Id<"complaints">;
  onClose: () => void;
};

export default function ComplaintDetailPanel({ complaintId, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);
  const notesEndRef = useRef<HTMLDivElement>(null);

  const complaint = useQuery(api.complaints.getById, { complaintId });
  const me = useQuery(api.users.me);
  const users = useQuery(api.users.listAllActive);
  const installationTeams = useQuery(api.installationTeams.listActive) ?? [];

  const currentClient = useQuery(api.clients.getById, complaint?.clientId ? { clientId: complaint.clientId } : "skip");
  const currentOrder = useQuery(api.orders.getById, complaint?.orderId ? { orderId: complaint.orderId } : "skip");

  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const searchResults = useQuery(
    api.clients.search,
    clientSearch.trim().length >= 2 ? { searchTerm: clientSearch } : "skip"
  );

  const [showOrderPicker, setShowOrderPicker] = useState(false);
  const clientOrders = useQuery(
    api.orders.listByClient,
    complaint?.clientId ? { clientId: complaint.clientId } : "skip"
  );

  const updateStatus = useMutation(api.complaints.updateStatus);
  const updateDetails = useMutation(api.complaints.updateDetails);
  const deleteComplaint = useMutation(api.complaints.deleteComplaint);
  const addNote = useMutation(api.complaints.addNote);
  const deleteNote = useMutation(api.complaints.deleteNote);

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

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      setTimeout(() => {
        if (!document.querySelector("[data-complaint-panel]")) {
          document.body.style.overflow = "";
        }
      }, 0);
    };
  }, []);

  useEffect(() => {
    notesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [complaint?.notes?.length]);

  const handleAddNote = useCallback(async () => {
    const text = newNote.trim();
    if (!text || !complaint) return;
    setAddingNote(true);
    try {
      await addNote({
        complaintId,
        text,
        createdBy: me?.displayName ?? me?.login ?? "Nieznany",
      });
      setNewNote("");
    } finally {
      setAddingNote(false);
    }
  }, [newNote, complaint, addNote, complaintId, me]);

  const panelStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    right: 0,
    bottom: 0,
    width: "520px",
    maxWidth: "100vw",
    zIndex: 600,
    background: "var(--panel, #fff)",
    borderLeft: "1px solid var(--line)",
    display: "flex",
    flexDirection: "column",
    boxShadow: "-8px 0 40px rgba(0,0,0,0.15)",
    transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    transform: visible ? "translateX(0)" : "translateX(100%)",
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    await deleteComplaint({ complaintId });
    onClose();
  };

  if (complaint === undefined) {
    return createPortal(
      <div style={panelStyle} data-complaint-panel="true">
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 13, color: "var(--text-mute)" }}>Ładowanie…</span>
        </div>
      </div>,
      document.body,
    );
  }

  if (!complaint) return null;

  const status = complaint.status as Status;
  const statusColors = STATUS_COLORS[status] ?? STATUS_COLORS.nowa;
  const notes = [
    ...(complaint.notes ?? []),
    ...(complaint.entries ?? []).filter((e) => e.type === "note").map((e) => ({
      id: e.id,
      text: e.text,
      createdAt: e.createdAt,
      createdBy: e.createdBy,
    })),
  ].sort((a, b) => a.createdAt - b.createdAt);

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 599,
          background: "rgba(0,0,0,0.2)",
        }}
      />
      <div style={panelStyle} data-complaint-panel="true">
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid var(--line)",
            flexShrink: 0,
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-strong)" }}>
              Reklamacja
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 20,
                background: statusColors.bg,
                color: statusColors.color,
                border: `1px solid ${statusColors.border}`,
              }}
            >
              {STATUS_LABELS[status]}
            </span>
            {status !== "zamknieta" && status !== "rozwiazana" && (
              <button
                type="button"
                onClick={() => updateStatus({ complaintId, status: "zamknieta" })}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 9px",
                  borderRadius: 20,
                  background: "#f0fdf4",
                  color: "#15803d",
                  border: "1px solid #bbf7d0",
                  cursor: "pointer",
                }}
              >
                <CheckCircle2 size={12} /> Zamknij
              </button>
            )}
          </div>
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

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 0 }}>
          {/* Meta info */}
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Date */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11.5, color: "var(--text-mute)", width: 120, flexShrink: 0 }}>Data reklamacji</span>
              <span style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 500 }}>
                {formatDate(complaint.startDate)}
              </span>
            </div>
            {/* Service Date */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ fontSize: 11.5, color: "var(--text-mute)", width: 120, flexShrink: 0, paddingTop: 5 }}>Data serwisu</span>
              <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", flex: 1 }}>
                <input
                  type="date"
                  value={complaint.serviceDate ? new Date(complaint.serviceDate).toISOString().slice(0, 10) : ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) {
                      updateDetails({ complaintId, serviceDate: undefined, serviceDateEnd: undefined });
                      return;
                    }
                    // Preserve existing time from serviceDate if present
                    const existing = complaint.serviceDate ? new Date(complaint.serviceDate) : null;
                    const base = new Date(val);
                    if (existing && (existing.getHours() !== 0 || existing.getMinutes() !== 0)) {
                      base.setHours(existing.getHours(), existing.getMinutes(), 0, 0);
                    }
                    // Recalculate end date on same new day
                    let newEnd: number | undefined;
                    if (complaint.serviceDateEnd) {
                      const existingEnd = new Date(complaint.serviceDateEnd);
                      const endBase = new Date(val);
                      endBase.setHours(existingEnd.getHours(), existingEnd.getMinutes(), 0, 0);
                      newEnd = endBase.getTime();
                    }
                    updateDetails({ complaintId, serviceDate: base.getTime(), serviceDateEnd: newEnd });
                  }}
                  style={{
                    fontSize: 12,
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: "1px solid var(--line)",
                    background: "var(--panel-2)",
                    color: "var(--text)",
                    fontFamily: "inherit",
                  }}
                />
                <span style={{ fontSize: 11.5, color: "var(--text-mute)" }}>od</span>
                <select
                  value={complaint.serviceDate && (new Date(complaint.serviceDate).getHours() !== 0 || new Date(complaint.serviceDate).getMinutes() !== 0)
                    ? `${String(new Date(complaint.serviceDate).getHours()).padStart(2, "0")}:${String(new Date(complaint.serviceDate).getMinutes()).padStart(2, "0")}`
                    : ""}
                  disabled={!complaint.serviceDate}
                  onChange={(e) => {
                    if (!complaint.serviceDate) return;
                    const val = e.target.value;
                    if (!val) return;
                    const [h, m] = val.split(":").map(Number);
                    const base = new Date(complaint.serviceDate);
                    base.setHours(h, m, 0, 0);
                    updateDetails({ complaintId, serviceDate: base.getTime() });
                  }}
                  style={{
                    fontSize: 12,
                    padding: "4px 6px",
                    borderRadius: 6,
                    border: "1px solid var(--line)",
                    background: complaint.serviceDate ? "var(--panel-2)" : "var(--panel)",
                    color: "var(--text)",
                    fontFamily: "inherit",
                    opacity: complaint.serviceDate ? 1 : 0.5,
                  }}
                >
                  <option value="">—</option>
                  {FULL_HOURS.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <span style={{ fontSize: 11.5, color: "var(--text-mute)" }}>do</span>
                <select
                  value={complaint.serviceDateEnd
                    ? `${String(new Date(complaint.serviceDateEnd).getHours()).padStart(2, "0")}:${String(new Date(complaint.serviceDateEnd).getMinutes()).padStart(2, "0")}`
                    : ""}
                  disabled={!complaint.serviceDate}
                  onChange={(e) => {
                    if (!complaint.serviceDate) return;
                    const val = e.target.value;
                    if (!val) {
                      updateDetails({ complaintId, serviceDateEnd: undefined });
                      return;
                    }
                    const [h, m] = val.split(":").map(Number);
                    const base = new Date(complaint.serviceDate);
                    base.setHours(h, m, 0, 0);
                    updateDetails({ complaintId, serviceDateEnd: base.getTime() });
                  }}
                  style={{
                    fontSize: 12,
                    padding: "4px 6px",
                    borderRadius: 6,
                    border: "1px solid var(--line)",
                    background: complaint.serviceDate ? "var(--panel-2)" : "var(--panel)",
                    color: "var(--text)",
                    fontFamily: "inherit",
                    opacity: complaint.serviceDate ? 1 : 0.5,
                  }}
                >
                  <option value="">—</option>
                  {FULL_HOURS.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                {complaint.serviceDate && (
                  <button
                    type="button"
                    onClick={() => updateDetails({ complaintId, serviceDate: undefined, serviceDateEnd: undefined })}
                    title="Wyczyść datę serwisu"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-mute)",
                      fontSize: 11,
                      padding: "2px 4px",
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            {/* Status selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, color: "var(--text-mute)", width: 120, flexShrink: 0 }}>Status</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(Object.keys(STATUS_LABELS) as Status[]).map((s) => {
                  const isActive = complaint.status === s;
                  const colors = STATUS_COLORS[s];
                  return (
                    <button
                      key={s}
                      onClick={() => updateStatus({ complaintId, status: s })}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "4px 10px",
                        borderRadius: 20,
                        border: `1px solid ${isActive ? colors.border : "var(--line)"}`,
                        background: isActive ? colors.bg : "var(--panel-2)",
                        color: isActive ? colors.color : "var(--text-mute)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Client Picker */}
            <div className="border border-gray-200 bg-gray-50/50 rounded-md p-3">
              {!showClientPicker ? (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Klient</div>
                    <div className="text-xs text-gray-700 mt-0.5 font-medium">
                      {currentClient 
                        ? ([currentClient.firstName, currentClient.lastName].filter(Boolean).join(" ") || currentClient.companyName || currentClient._id)
                        : "Brak przypisanego klienta"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {complaint.clientId && (
                      <a
                        href={`/admin/klient/${complaint.clientId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                        title="Przejdź do klienta"
                        style={{ textDecoration: "none" }}
                      >
                        Otwórz
                      </a>
                    )}
                    <button
                      onClick={() => setShowClientPicker(true)}
                      className="flex shrink-0 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <UserPlus className="size-3.5" /> Zmień
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Przypisz klienta:</div>
                    <button onClick={() => { setShowClientPicker(false); setClientSearch(""); }} className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600 transition-colors">
                      <X className="size-3.5" />
                    </button>
                  </div>
                  
                  <div className="relative mb-2">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                    <input
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      placeholder="Wpisz nazwisko lub firmę (min. 2 znaki)…"
                      className="w-full rounded-md border border-gray-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-gray-400 bg-white"
                    />
                  </div>
                  <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                    {clientSearch.trim().length >= 2 ? (
                      searchResults === undefined ? (
                        <div className="text-xs text-gray-400 px-2 py-1">Szukanie...</div>
                      ) : searchResults.length === 0 ? (
                        <div className="text-xs text-gray-400 px-2 py-1">Brak wyników.</div>
                      ) : (
                        searchResults.map((c) => {
                          const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.companyName || c._id;
                          return (
                            <button
                              key={c._id}
                              onClick={() => {
                                updateDetails({ complaintId, clientId: c._id, orderId: undefined });
                                setShowClientPicker(false);
                                setClientSearch("");
                              }}
                              className="flex w-full flex-col items-start rounded-md border border-gray-100 bg-white px-3 py-2 text-left hover:border-gray-300 hover:bg-gray-50 transition-colors"
                            >
                              <span className="flex w-full items-center gap-2">
                                <span className="truncate text-[13px] font-medium text-gray-900">{name}</span>
                                {c.companyName && [c.firstName, c.lastName].filter(Boolean).length > 0 && (
                                  <span className="text-[11px] text-gray-400">({c.companyName})</span>
                                )}
                              </span>
                            </button>
                          );
                        })
                      )
                    ) : (
                      <div className="text-xs text-gray-400 px-2 py-1">Wpisz co najmniej 2 znaki...</div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Order Picker */}
            <div className={`border border-gray-200 bg-gray-50/50 rounded-md p-3 ${!complaint.clientId ? "opacity-50 pointer-events-none" : ""}`}>
              {!showOrderPicker ? (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Zlecenie</div>
                    <div className="text-xs text-gray-700 mt-0.5 font-medium">
                      {currentOrder 
                        ? (currentOrder.name ?? currentOrder.customText ?? "Zlecenie bez nazwy")
                        : "Brak przypisanego zlecenia"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {complaint.orderId && complaint.clientId && (
                      <a
                        href={`/admin/klient/${complaint.clientId}/zlecenie/${complaint.orderId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                        title="Przejdź do zlecenia"
                        style={{ textDecoration: "none" }}
                      >
                        Otwórz
                      </a>
                    )}
                    <button
                      onClick={() => setShowOrderPicker(true)}
                      className="flex shrink-0 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <UserPlus className="size-3.5" /> Zmień
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Przypisz zlecenie:</div>
                    <button onClick={() => setShowOrderPicker(false)} className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600 transition-colors">
                      <X className="size-3.5" />
                    </button>
                  </div>
                  
                  <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                    <button
                      onClick={() => {
                        updateDetails({ complaintId, orderId: undefined });
                        setShowOrderPicker(false);
                      }}
                      className="flex w-full flex-col items-start rounded-md border border-gray-100 bg-white px-3 py-2 text-left hover:border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      <span className="truncate text-[13px] font-medium text-gray-500">— Usuń przypisanie zlecenia —</span>
                    </button>
                    {clientOrders === undefined ? (
                      <div className="text-xs text-gray-400 px-2 py-1">Ładowanie...</div>
                    ) : clientOrders.length === 0 ? (
                      <div className="text-xs text-gray-400 px-2 py-1">Ten klient nie ma żadnych zleceń.</div>
                    ) : (
                      clientOrders.map((o) => (
                        <button
                          key={o._id}
                          onClick={() => {
                            updateDetails({ complaintId, orderId: o._id });
                            setShowOrderPicker(false);
                          }}
                          className="flex w-full flex-col items-start rounded-md border border-gray-100 bg-white px-3 py-2 text-left hover:border-gray-300 hover:bg-gray-50 transition-colors"
                        >
                          <span className="flex w-full items-center gap-2">
                            <span className="truncate text-[13px] font-medium text-gray-900">{o.name ?? "Zlecenie bez nazwy"}</span>
                            {o.customText && <span className="chip-custom shrink-0">{o.customText}</span>}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
            {/* Assigned to */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11.5, color: "var(--text-mute)", width: 120, flexShrink: 0 }}>Przypisany do</span>
              <select
                value={complaint.assignedTo ?? ""}
                onChange={(e) =>
                  updateDetails({ complaintId, assignedTo: e.target.value || undefined })
                }
                style={{
                  fontSize: 12,
                  padding: "3px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--line)",
                  background: "var(--panel-2)",
                  color: "var(--text)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  flex: 1,
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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11.5, color: "var(--text-mute)", width: 120, flexShrink: 0 }}>Ekipa montażowa</span>
              <select
                value={complaint.installationTeamId ?? ""}
                onChange={(e) =>
                  updateDetails({
                    complaintId,
                    installationTeamId: e.target.value ? (e.target.value as Id<"installationTeams">) : null,
                  })
                }
                style={{
                  fontSize: 12,
                  padding: "3px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--line)",
                  background: "var(--panel-2)",
                  color: "var(--text)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  flex: 1,
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
          </div>

          {/* Uwagi klienta */}
          <ComplaintSection title="Uwagi klienta">
            <EditableTextArea
              value={complaint.clientDescription ?? ""}
              placeholder="Wpisz uwagi zgłoszone przez klienta…"
              onSave={(val) => updateDetails({ complaintId, clientDescription: val })}
            />
          </ComplaintSection>

          {/* Zdjęcia */}
          <ComplaintSection title="Zdjęcia">
            <ComplaintPhotoSection
              clientId={complaint.clientId}
              orderId={complaint.orderId}
              complaintId={complaintId}
              complaintFolderId={complaint.complaintFolderId}
            />
          </ComplaintSection>

          {/* Notatki wewnętrzne */}
          <ComplaintSection title="Notatki wewnętrzne">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {notes.length === 0 && (
                <p style={{ fontSize: 12, color: "var(--text-mute)", margin: 0 }}>Brak notatek.</p>
              )}
              {notes.map((note) => (
                <div
                  key={note.id}
                  style={{
                    display: "flex",
                    gap: 8,
                    padding: "8px 10px",
                    background: "var(--panel-2)",
                    borderRadius: 6,
                    border: "1px solid var(--line)",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 12.5, color: "var(--text)", whiteSpace: "pre-wrap" }}>
                      {note.text}
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-mute)" }}>
                      {note.createdBy} · {formatDateTime(note.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteNote({ complaintId, noteId: note.id })}
                    title="Usuń notatkę"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#cbd5e1",
                      padding: 0,
                      alignSelf: "flex-start",
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#cbd5e1"; }}
                  >
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <div ref={notesEndRef} />
              {/* Add note */}
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <textarea
                  ref={noteInputRef}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Dodaj notatkę wewnętrzną…"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      void handleAddNote();
                    }
                  }}
                  style={{
                    flex: 1,
                    fontSize: 12.5,
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--line)",
                    background: "var(--panel-2)",
                    color: "var(--text)",
                    fontFamily: "inherit",
                    resize: "none",
                    outline: "none",
                  }}
                />
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || addingNote}
                  className="btn"
                  style={{ alignSelf: "flex-end", fontSize: 11, padding: "6px 12px" }}
                >
                  {addingNote ? "…" : "Dodaj"}
                </button>
              </div>
              <p style={{ margin: 0, fontSize: 10.5, color: "var(--text-mute)" }}>Ctrl+Enter aby zapisać</p>
            </div>
          </ComplaintSection>
          
          <div style={{ padding: "16px", marginTop: "auto" }}>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  width: "100%",
                  padding: "10px",
                  backgroundColor: "#fee2e2",
                  color: "#dc2626",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#fecaca")}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#fee2e2")}
              >
                Usuń reklamację
              </button>
            ) : (
              <div style={{ background: "#fef2f2", padding: "12px", borderRadius: "8px", border: "1px solid #fecaca" }}>
                <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#991b1b", textAlign: "center" }}>
                  Czy na pewno chcesz usunąć tę reklamację?
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    style={{
                      flex: 1,
                      padding: "8px",
                      background: "white",
                      border: "1px solid #fecaca",
                      borderRadius: "6px",
                      color: "#7f1d1d",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Anuluj
                  </button>
                  <button
                    onClick={handleDelete}
                    style={{
                      flex: 1,
                      padding: "8px",
                      background: "#dc2626",
                      border: "none",
                      borderRadius: "6px",
                      color: "white",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Tak, usuń
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

function ComplaintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
      <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-mute)" }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function EditableTextArea({
  value,
  placeholder,
  onSave,
}: {
  value: string;
  placeholder: string;
  onSave: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (!editing) setDraft(value);
  }

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(value); setEditing(true); }}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          background: "none",
          border: "1px dashed var(--line)",
          borderRadius: 6,
          padding: "7px 10px",
          cursor: "text",
          fontSize: 12.5,
          color: value ? "var(--text)" : "var(--text-mute)",
          fontFamily: "inherit",
          minHeight: 36,
          whiteSpace: "pre-wrap",
        }}
      >
        {value || placeholder}
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={4}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setEditing(false); setDraft(value); }
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            onSave(draft);
            setEditing(false);
          }
        }}
        style={{
          fontSize: 12.5,
          padding: "7px 10px",
          borderRadius: 6,
          border: "1px solid var(--accent)",
          background: "var(--panel-2)",
          color: "var(--text)",
          fontFamily: "inherit",
          resize: "vertical",
          outline: "none",
        }}
      />
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={() => { onSave(draft); setEditing(false); }}
          className="btn"
          style={{ fontSize: 11 }}
        >
          Zapisz
        </button>
        <button
          onClick={() => { setEditing(false); setDraft(value); }}
          style={{
            background: "none",
            border: "1px solid var(--line)",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 11,
            padding: "4px 10px",
            color: "var(--text-mute)",
            fontFamily: "inherit",
          }}
        >
          Anuluj
        </button>
        <span style={{ fontSize: 10.5, color: "var(--text-mute)", alignSelf: "center" }}>Ctrl+Enter aby zapisać</span>
      </div>
    </div>
  );
}
