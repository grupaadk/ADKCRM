"use client";

import { use, useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import InlineEdit from "@/app/admin/klient/[id]/InlineEdit";
import AddressSearch, { type AddressData } from "@/components/AddressSearch";
import { useStatusLabel } from "@/components/StatusLabelsContext";
import { ArrowLeft, Archive, ArchiveRestore, Trash2, Send, MapPin, Building2, MessageSquare, Sliders } from "lucide-react";
import DriveFolderButton from "@/components/DriveFolderButton";
import OpportunityAttachmentsSection from "./OpportunityAttachmentsSection";

const FIELD_LABEL: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: "var(--text-mute)",
  margin: 0,
  marginBottom: 4,
};

interface ConfiguratorObject {
  variant?: string;
  width?: string;
  depth?: string;
  dimensions?: string;
  area?: string;
  options?: string;
  location?: string;
  userNotes?: string;
}

function parseConfiguratorData(commentStr?: string): { parsedConfig: ConfiguratorObject | null; displayComment: string } {
  if (!commentStr) return { parsedConfig: null, displayComment: "" };

  const hasConfigKeywords =
    commentStr.includes("Wariant:") ||
    commentStr.includes("Wymiary:") ||
    commentStr.includes("Wyposażenie:");

  if (!hasConfigKeywords) {
    return { parsedConfig: null, displayComment: commentStr };
  }

  const parts = commentStr.split("|").map(s => s.trim());
  const config: ConfiguratorObject = {};
  const notesParts: string[] = [];

  for (const part of parts) {
    if (part.startsWith("Wariant:")) {
      config.variant = part.replace(/^Wariant:\s*/, "").trim();
    } else if (part.startsWith("Wymiary:")) {
      const dimStr = part.replace(/^Wymiary:\s*/, "").trim();
      const areaMatch = dimStr.match(/\(([^)]+)\)/);
      if (areaMatch) {
        config.area = areaMatch[1].trim();
        config.dimensions = dimStr.replace(/\s*\([^)]+\)/, "").trim();
      } else {
        config.dimensions = dimStr;
      }
    } else if (part.startsWith("Wyposażenie:")) {
      config.options = part.replace(/^Wyposażenie:\s*/, "").trim();
    } else if (part.startsWith("Lokalizacja:")) {
      config.location = part.replace(/^Lokalizacja:\s*/, "").trim();
    } else if (part.startsWith("Uwagi:")) {
      const val = part.replace(/^Uwagi:\s*/, "").trim();
      if (val && val !== "Brak dodatkowych uwag") {
        config.userNotes = val;
      }
    } else if (!part.startsWith("Załączone pliki")) {
      notesParts.push(part);
    }
  }

  const cleanNotes = [config.userNotes, ...notesParts].filter(Boolean).join("\n");

  return {
    parsedConfig: (config.variant || config.dimensions || config.options) ? config : null,
    displayComment: cleanNotes,
  };
}

// Ikona usługi dopasowana do nazwy — jak w widoku zlecenia
function ServiceIcon({ name, size = 15 }: { name: string; size?: number }) {
  const n = name.toLowerCase();
  let path: string;
  if (n.includes("okn")) {
    path = "M4 4h16v16H4zM12 4v16M4 12h16";
  } else if (n.includes("drzw")) {
    path = "M6 21V4a1 1 0 011-1h8a1 1 0 011 1v17M5 21h14M13.5 12h.01";
  } else if (n.includes("bram")) {
    path = "M4 21V6a2 2 0 012-2h12a2 2 0 012 2v15M4 21h16M4 9.5h16M4 13.5h16M4 17.5h16";
  } else if (n.includes("taras") || n.includes("zabud")) {
    path = "M3 21h18M5 21V10l7-5 7 5v11M9.5 21v-5h5v5";
  } else if (n.includes("alumin") || n.includes("konstr")) {
    path = "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z";
  } else if (n.includes("ogrodz")) {
    path = "M3 13h18M3 17h18M6 21V7l1.5-2L9 7v14M15 21V7l1.5-2L18 7v14";
  } else if (
    n.includes("słoneczn") || n.includes("sloneczn") ||
    n.includes("rolet") || n.includes("przeciw")
  ) {
    path = "M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4M12 8a4 4 0 100 8 4 4 0 000-8z";
  } else {
    path = "M9.6 3.6 3.6 9.6a2 2 0 0 0 0 2.8l8 8a2 2 0 0 0 2.8 0l6-6a2 2 0 0 0 0-2.8l-8-8A2 2 0 0 0 11 3H5a2 2 0 0 0-2 2v6M7.5 7.5h.01";
  }
  return (
    <svg
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

export default function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const opportunityId = id as Id<"pendingJotformSubmissions">;
  const router = useRouter();

  const opp = useQuery(api.salesOpportunities.getSalesOpportunity, { opportunityId });
  const updateField = useMutation(api.salesOpportunities.updateOpportunity);
  const updateStage = useMutation(api.salesOpportunities.updateOpportunityStage);
  const archive = useMutation(api.salesOpportunities.archiveOpportunity);
  const unarchive = useMutation(api.salesOpportunities.unarchiveOpportunity);
  const deleteOpp = useMutation(api.salesOpportunities.deleteSalesOpportunity);
  const convert = useMutation(api.salesOpportunities.convertToOrder);
  const retryFolder = useMutation(api.salesOpportunities.retryCreateFolderAndUploadFiles);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [converting, setConverting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [editingServices, setEditingServices] = useState(false);
  const [draftServices, setDraftServices] = useState<string[]>([]);
  const assignDropdownRef = useRef<HTMLDivElement>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  const me = useQuery(api.users.me);
  const isAdmin = me?.role === "admin";
  const assignOpportunity = useMutation(api.salesOpportunities.assignOpportunity);
  const assignableUsers = useQuery(api.users.listAllActive) ?? [];
  const servicesList = useQuery(api.services.listActive) ?? [];
  const serviceNames = servicesList.map((s) => s.name);

  useEffect(() => {
    const el = commentRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [opp?.comment]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (assignDropdownRef.current && !assignDropdownRef.current.contains(e.target as Node)) {
        setShowAssignDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const stage = opp?.stage ?? "lead";
  const stageLabel = useStatusLabel(stage);

  if (opp === undefined) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 256 }}>
        <span className="mute" style={{ fontSize: 13 }}>Ładowanie…</span>
      </div>
    );
  }

  if (opp === null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 256, gap: 16 }}>
        <span className="mute" style={{ fontSize: 13 }}>Szansa sprzedaży nie znaleziona.</span>
        <Link href="/admin/panel?tab=opportunities" style={{ fontSize: 13, color: "var(--accent)" }}>Wróć do panelu</Link>
      </div>
    );
  }

  if (opp.processed) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 256, gap: 12 }}>
        <span className="mute" style={{ fontSize: 13 }}>
          Ta szansa została już przekonwertowana do zlecenia.
        </span>
        <Link href="/admin/panel?tab=opportunities" style={{ fontSize: 13, color: "var(--accent)" }}>
          Wróć do panelu
        </Link>
      </div>
    );
  }

  const save = (field: string, value: string | string[] | number | undefined) => {
    updateField({ opportunityId, [field]: value }).catch((err) => {
      setError(err instanceof Error ? err.message : "Wystąpił błąd");
      setTimeout(() => setError(null), 3000);
    });
  };


  async function handleStageChange(next: "lead" | "inquiry") {
    if (stage === next) return;
    try {
      await updateStage({ opportunityId, stage: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd zmiany etapu");
    }
  }

  async function handleConvert() {
    setError(null);
    setConverting(true);
    try {
      const { clientId, orderId } = await convert({ opportunityId });
      router.push(`/admin/klient/${clientId}/zlecenie/${orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się utworzyć zlecenia");
      setConverting(false);
    }
  }

  async function handleArchive() {
    try {
      if (opp?.archived) {
        await unarchive({ opportunityId });
      } else {
        await archive({ opportunityId });
      }
      router.push("/admin/panel?tab=opportunities");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd archiwizacji");
    }
  }

  async function handleDelete() {
    try {
      await deleteOpp({ opportunityId });
      router.push("/admin/panel?tab=opportunities");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd usuwania");
    }
  }

  async function handleRetryFolder() {
    setError(null);
    setRetrying(true);
    try {
      await retryFolder({ opportunityId });
      await new Promise((resolve) => setTimeout(resolve, 2000));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd tworzenia folderu");
      setRetrying(false);
    }
  }

  const selectedServices = opp.services ?? [];
  const isTerraceService = selectedServices.includes("Zabudowa tarasu");
  const { parsedConfig, displayComment } = parseConfiguratorData(opp.comment);

  const mainAddressStr = [opp.street, opp.postalCode, opp.city].filter(Boolean).join(", ");
  const investmentAddressStr = [opp.investmentStreet, opp.investmentPostalCode, opp.investmentCity].filter(Boolean).join(", ");
  const mainMapsUrl = mainAddressStr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mainAddressStr)}` : null;
  const investmentMapsUrl = investmentAddressStr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(investmentAddressStr)}` : null;

  // Wykryj czy adres inwestycji = adres klienta (stan UI-owy)
  // Inicjalizacja bezpieczna — opp może być null/undefined na etapie hydratacji,
  // ale useState lazy initializer wywołany jest tylko raz, więc używamy optional chaining
  const [sameAddress, setSameAddress] = useState<boolean>(() => {
    if (!opp || typeof opp !== "object" || !("street" in opp)) return false;
    const o = opp as NonNullable<typeof opp>;
    return (
      (o.investmentStreet ?? "") === (o.street ?? "") &&
      (o.investmentBuildingNumber ?? "") === (o.buildingNumber ?? "") &&
      (o.investmentPostalCode ?? "") === (o.postalCode ?? "") &&
      (o.investmentCity ?? "") === (o.city ?? "") &&
      !!(o.street || o.city)
    );
  });

  function handleAddress(a: AddressData) {
    const patch: Record<string, string> = {};
    if (a.street) patch.street = a.street;
    if (a.buildingNumber) patch.buildingNumber = a.buildingNumber;
    if (a.postalCode) patch.postalCode = a.postalCode;
    if (a.city) patch.city = a.city;
    if (Object.keys(patch).length > 0) {
      void updateField({ opportunityId, ...patch });
      // Jezeli "taki sam" to aktualizuj rowniez adres inwestycji
      if (sameAddress) {
        const investPatch: Record<string, string> = {};
        if (a.street) investPatch.investmentStreet = a.street;
        if (a.buildingNumber) investPatch.investmentBuildingNumber = a.buildingNumber;
        if (a.postalCode) investPatch.investmentPostalCode = a.postalCode;
        if (a.city) investPatch.investmentCity = a.city;
        void updateField({ opportunityId, ...investPatch });
      }
    }
  }

  function handleInvestmentAddress(a: AddressData) {
    const patch: Record<string, string> = {};
    if (a.street) patch.investmentStreet = a.street;
    if (a.buildingNumber) patch.investmentBuildingNumber = a.buildingNumber;
    if (a.postalCode) patch.investmentPostalCode = a.postalCode;
    if (a.city) patch.investmentCity = a.city;
    if (Object.keys(patch).length > 0) {
      void updateField({ opportunityId, ...patch });
    }
  }

  function handleSameAddressToggle(checked: boolean) {
    setSameAddress(checked);
    if (checked) {
      // Skopiuj adres klienta do adresu inwestycji
      void updateField({
        opportunityId,
        investmentStreet: opp.street,
        investmentBuildingNumber: opp.buildingNumber,
        investmentApartmentNumber: opp.apartmentNumber,
        investmentPostalCode: opp.postalCode,
        investmentCity: opp.city,
      });
    }
  }

  // Rating finansowy (jak w zleceniu)
  const profit = opp.profit;
  const workDays = opp.workDays;
  const dailyProfit = (profit !== undefined && workDays && workDays > 0) ? Math.round(profit / workDays) : null;
  let rating: number | null = null;
  if (dailyProfit !== null) {
    if (dailyProfit >= 5000) rating = 5;
    else if (dailyProfit >= 4000) rating = 4;
    else if (dailyProfit >= 3000) rating = 3;
    else if (dailyProfit >= 2000) rating = 2;
    else if (dailyProfit >= 1000) rating = 1;
    else rating = 0;
  }
  const C = 251.327;
  const pct = (rating ?? 0) / 5;
  const filledDash = C * pct;
  const strokeDasharray = `${filledDash} ${C - filledDash}`;
  const ratingColors: Record<number, string> = {
    5: "#10b981",
    4: "#84cc16",
    3: "#3b82f6",
    2: "#f97316",
    1: "#ef4444",
    0: "#94a3b8",
  };
  const ringColor = rating !== null ? (ratingColors[rating] ?? "#3b82f6") : "#cbd5e1";

  function startEditServices() {
    setDraftServices(selectedServices);
    setEditingServices(true);
  }
  function toggleDraftService(name: string) {
    setDraftServices((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
    );
  }
  function saveServices() {
    save("services", draftServices.length > 0 ? draftServices : undefined);
    setEditingServices(false);
  }
  function cancelEditServices() {
    setEditingServices(false);
    setDraftServices([]);
  }

  // Assignees
  const assigneesArray = Array.from(new Set([
    ...(opp.assignedUserId ? [opp.assignedUserId] : []),
    ...(opp.assignedUserIds || [])
  ]));
  const assignedUsers = assigneesArray.map(uid => assignableUsers.find((u) => u._id === uid)).filter(Boolean);
  const assignedName = assignedUsers.length === 0
    ? null
    : assignedUsers.length === 1
    ? (assignedUsers[0]!.displayName ?? assignedUsers[0]!.login ?? "")
    : `${assignedUsers.length} osoby`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* ── Header panel ── */}
      <div className="panel" style={{ overflow: "visible" }}>
        {/* Breadcrumb + actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            background: "#4abbc3",
            borderBottom: "1px solid rgba(11, 18, 32, 0.15)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#000000" }}>
            <Link
              href="/admin/panel?tab=opportunities"
              style={{ color: "#000000", fontWeight: 600, textDecoration: "none" }}
              onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
              onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}
            >
              Zlecenia
            </Link>
            <span style={{ color: "#000000", opacity: 0.7, fontWeight: 700 }}>›</span>
            <span style={{ color: "#000000", fontWeight: 500 }}>Szansa sprzedaży</span>
            {opp.submissionId && (
              <>
                <span style={{ color: "#000000", opacity: 0.7, fontWeight: 700 }}>›</span>
                <span style={{ color: "#000000", fontWeight: 600 }}>#{opp.submissionId}</span>
              </>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Przypisana osoba */}
            <div ref={assignDropdownRef} style={{ position: "relative" }}>
              <button
                onClick={() => setShowAssignDropdown((v) => !v)}
                className="btn"
                style={{
                  fontSize: 11,
                  padding: "4px 10px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  ...(assignedUsers.length === 1 && assignedUsers[0]!.color
                    ? { borderColor: assignedUsers[0]!.color + "80", color: assignedUsers[0]!.color }
                    : {}),
                }}
                title={assignedName ? `Przypisany: ${assignedName}` : "Przypisz osobę"}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                {assignedName ?? "+ Przypisz"}
              </button>
              {showAssignDropdown && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    right: 0,
                    minWidth: 180,
                    background: "var(--panel)",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                    zIndex: 500,
                    overflow: "hidden",
                  }}
                >
                  {assignableUsers.map((u) => (
                    <button
                      key={u._id}
                      onClick={() => {
                        if (assigneesArray.includes(u._id)) {
                          void assignOpportunity({ opportunityId, assignedUserIds: assigneesArray.filter(uid => uid !== u._id) });
                        } else {
                          void assignOpportunity({ opportunityId, assignedUserIds: [...assigneesArray, u._id] });
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        width: "100%",
                        textAlign: "left",
                        padding: "6px 12px",
                        fontSize: 12,
                        background: assigneesArray.includes(u._id) ? "var(--panel-2)" : "transparent",
                        border: "none",
                        borderBottom: "1px solid var(--line)",
                        cursor: "pointer",
                        color: "var(--text)",
                        fontFamily: "inherit",
                        fontWeight: assigneesArray.includes(u._id) ? 600 : 400,
                      }}
                    >
                      {u.color && (
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: u.color, flexShrink: 0 }} />
                      )}
                      <span style={{ flex: 1 }}>{u.displayName ?? u.login}</span>
                      {assigneesArray.includes(u._id) && (
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: "#2563eb", flexShrink: 0 }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </button>
                  ))}
                  {assigneesArray.length > 0 && (
                    <button
                      onClick={() => {
                        void assignOpportunity({ opportunityId, assignedUserIds: [] });
                        setShowAssignDropdown(false);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "6px 12px",
                        fontSize: 12,
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--bad, #ef4444)",
                        fontFamily: "inherit",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fee2e2"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                    >
                      Usuń przypisanie
                    </button>
                  )}
                </div>
              )}
            </div>

            <DriveFolderButton
              folderUrl={opp.opportunityFolderUrl}
              createdAt={opp._creationTime}
              onCreate={handleRetryFolder}
              busy={retrying}
            />
            <button
              onClick={handleArchive}
              className="btn"
              style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", fontSize: 11.5 }}
              title={opp.archived ? "Przywróć z archiwum" : "Archiwizuj"}
            >
              {opp.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
              {opp.archived ? "Przywróć" : "Archiwizuj"}
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="btn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "5px 10px",
                fontSize: 11.5,
                color: "#dc2626",
                borderColor: "#fca5a5",
              }}
              title="Usuń szansę"
            >
              <Trash2 size={13} /> Usuń
            </button>
          </div>
        </div>

        {/* Title + stage bar */}
        <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", borderBottom: "1px solid var(--line)" }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-strong)", margin: 0, lineHeight: 1.2 }}>
              {opp.firstName} {opp.lastName}
            </h1>
            <p style={{ fontSize: 12, color: "var(--text-mute)", margin: "3px 0 0" }}>
              Szansa sprzedaży · {stageLabel}
              {opp.submissionId && ` · #${opp.submissionId}`}
              {opp.archived && " · ZARCHIWIZOWANA"}
            </p>
          </div>

          {/* Etap + konwersja */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={FIELD_LABEL}>Etap:</span>
              <div style={{ display: "flex", gap: 4 }}>
                {(["lead", "inquiry"] as const).map((s) => {
                  const active = stage === s;
                  return (
                    <button
                      key={s}
                      onClick={() => handleStageChange(s)}
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        padding: "4px 12px",
                        borderRadius: 6,
                        border: `1px solid ${active ? "#1d4ed8" : "var(--line)"}`,
                        background: active ? "#2563eb" : "var(--panel)",
                        color: active ? "#fff" : "var(--text)",
                        cursor: "pointer",
                        transition: "all 0.1s ease",
                      }}
                    >
                      {s === "lead" ? "Oferty" : "Oferta wysłana"}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              onClick={handleConvert}
              disabled={stage !== "inquiry" || converting}
              className="btn primary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                padding: "5px 12px",
                opacity: stage !== "inquiry" || converting ? 0.5 : 1,
                cursor: stage !== "inquiry" || converting ? "not-allowed" : "pointer",
              }}
            >
              <Send size={13} />
              {converting ? "Tworzenie..." : "Utwórz zlecenie"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            color: "#dc2626",
            borderRadius: 6,
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      {/* ── Główny horyzontalny box: Dane klienta + Adresy + Finanse i Rating — 4 kolumny ── */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
        {/* Nagłówek */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>
          <span style={{ width: 4, height: 18, borderRadius: 3, background: "var(--accent)", flexShrink: 0 }} />
          <Building2 size={14} color="var(--accent)" />
          <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--text-strong)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Dane klienta, Finanse i Adresy
          </span>
        </div>

        {/* 4-kolumnowy układ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 0 }}>

          {/* Kolumna 1: Dane klienta */}
          <div style={{ padding: "14px 16px", borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ ...FIELD_LABEL, marginBottom: 6 }}>Dane kontaktowe</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <InlineEdit label="Imię" value={opp.firstName} onSave={(v) => save("firstName", v)} />
              <InlineEdit label="Nazwisko" value={opp.lastName} onSave={(v) => save("lastName", v)} />
              <InlineEdit label="E-mail" value={opp.email ?? ""} placeholder="—" onSave={(v) => save("email", v || undefined)} />
              <InlineEdit label="Telefon" value={opp.phone ?? ""} placeholder="—" onSave={(v) => save("phone", v || undefined)} />
            </div>
            <div style={{ marginTop: 4, paddingTop: 8, borderTop: "1px solid var(--line)" }}>
              <InlineEdit
                label="Identyfikator Kanban"
                value={opp.customText ?? ""}
                placeholder="np. KOWALSKI – Zabudowa tarasu"
                onSave={(v) => save("customText", v || undefined)}
              />
            </div>
          </div>

          {/* Kolumna 2: Adres klienta */}
          <div style={{ padding: "14px 16px", borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
              <p style={FIELD_LABEL}>Adres klienta</p>
              {mainMapsUrl && (
                <a href={mainMapsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10.5, color: "#2563eb", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <MapPin size={11} /> Maps
                </a>
              )}
            </div>
            <AddressSearch onSelect={handleAddress} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <InlineEdit label="Ulica" value={opp.street ?? ""} placeholder="—" onSave={(v) => { save("street", v || undefined); if (sameAddress) save("investmentStreet", v || undefined); }} />
              <InlineEdit label="Nr bud. / mieszk." value={[opp.buildingNumber, opp.apartmentNumber].filter(Boolean).join("/")} placeholder="—" onSave={(v) => {
                const parts = v ? v.split("/") : [];
                save("buildingNumber", parts[0] || undefined);
                save("apartmentNumber", parts[1] || undefined);
                if (sameAddress) {
                  save("investmentBuildingNumber", parts[0] || undefined);
                  save("investmentApartmentNumber", parts[1] || undefined);
                }
              }} />
              <InlineEdit label="Kod pocztowy" value={opp.postalCode ?? ""} placeholder="—" onSave={(v) => { save("postalCode", v || undefined); if (sameAddress) save("investmentPostalCode", v || undefined); }} />
              <InlineEdit label="Miejscowość" value={opp.city ?? ""} placeholder="—" onSave={(v) => { save("city", v || undefined); if (sa          {/* Kolumna 3: Adres inwestycji + toggle */}
          <div style={{ padding: "14px 16px", borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
              <p style={FIELD_LABEL}>Adres inwestycji (montaż)</p>
              {investmentMapsUrl && !sameAddress && (
                <a href={investmentMapsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10.5, color: "#0284C7", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <MapPin size={11} /> Maps
                </a>
              )}
            </div>

            {/* Toggle „Taki sam jak klienta" */}
            <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", userSelect: "none" }}>
              <div
                onClick={() => handleSameAddressToggle(!sameAddress)}
                style={{
                  width: 34,
                  height: 18,
                  borderRadius: 9,
                  background: sameAddress ? "var(--accent)" : "var(--line)",
                  position: "relative",
                  flexShrink: 0,
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
              >
                <div style={{
                  position: "absolute",
                  top: 2,
                  left: sameAddress ? 18 : 2,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  transition: "left 0.2s",
                }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: sameAddress ? "var(--accent)" : "var(--text-mute)" }}>
                Taki sam jak klienta
              </span>
            </label>

            {sameAddress ? (
              /* Badge gdy adresy są takie same */
              <div style={{
                padding: "10px 12px",
                borderRadius: 8,
                background: "var(--accent-soft)",
                border: "1px dashed var(--accent)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                flex: 1,
              }}>
                <MapPin size={14} color="var(--accent)" />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>Taki sam jak adres klienta</div>
                  {mainAddressStr && (
                    <div style={{ fontSize: 10.5, color: "var(--text-mute)", marginTop: 2 }}>{mainAddressStr}</div>
                  )}
                </div>
              </div>
            ) : (
              /* Pola adresu inwestycji */
              <>
                <AddressSearch onSelect={handleInvestmentAddress} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <InlineEdit label="Ulica" value={opp.investmentStreet ?? ""} placeholder="—" onSave={(v) => save("investmentStreet", v || undefined)} />
                  <InlineEdit label="Nr bud. / mieszk." value={[opp.investmentBuildingNumber, opp.investmentApartmentNumber].filter(Boolean).join("/")} placeholder="—" onSave={(v) => {
                    const parts = v ? v.split("/") : [];
                    save("investmentBuildingNumber", parts[0] || undefined);
                    save("investmentApartmentNumber", parts[1] || undefined);
                  }} />
                  <InlineEdit label="Kod pocztowy" value={opp.investmentPostalCode ?? ""} placeholder="—" onSave={(v) => save("investmentPostalCode", v || undefined)} />
                  <InlineEdit label="Miejscowość" value={opp.investmentCity ?? ""} placeholder="—" onSave={(v) => save("investmentCity", v || undefined)} />
                </div>
              </>
            )}
          </div>

          {/* Kolumna 4 (ostatnia): Finanse i Rating */}
          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ ...FIELD_LABEL, marginBottom: 6 }}>Finanse i Rating</p>

            {/* Kompaktowy grid: Donut po lewej, pola po prawej */}
            <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 8, alignItems: "stretch" }}>

              {/* Wykres donut ratingu */}
              <div style={{
                background: "var(--card)",
                borderRadius: 10,
                border: "1px solid var(--line)",
                padding: "6px 4px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                textAlign: "center",
              }}>
                <div style={{ position: "relative", width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="56" height="56" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="50" cy="50" r="40" fill="none" stroke="var(--line)" strokeWidth="14" />
                    {rating !== null && (
                      <circle
                        cx="50" cy="50" r="40"
                        fill="none"
                        stroke={ringColor}
                        strokeWidth="14"
                        strokeDasharray={strokeDasharray}
                        strokeLinecap="round"
                        style={{ transition: "stroke-dasharray 0.5s ease" }}
                      />
                    )}
                  </svg>
                  <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                    <span style={{ fontSize: 16, fontWeight: 900, color: "var(--text-strong)", fontVariantNumeric: "tabular-nums" }}>
                      {rating !== null ? rating : "—"}
                    </span>
                    <span style={{ fontSize: 7.5, fontWeight: 700, color: "var(--text-mute)", marginTop: 1, textTransform: "uppercase" }}>
                      {rating !== null ? "z 5" : "brak"}
                    </span>
                  </div>
                </div>
                {rating !== null ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 800, color: ringColor }}>
                      {dailyProfit !== null ? `${dailyProfit.toLocaleString("pl-PL")} zł/d` : "—"}
                    </div>
                    <div style={{ fontSize: 8.5, color: "var(--text-mute)", lineHeight: 1.1 }}>
                      {rating === 5 && "≥ 5k zł/d"}
                      {rating === 4 && "≥ 4k zł/d"}
                      {rating === 3 && "≥ 3k zł/d"}
                      {rating === 2 && "≥ 2k zł/d"}
                      {rating === 1 && "≥ 1k zł/d"}
                      {rating === 0 && "< 1k zł/d"}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 8.5, color: "var(--text-mute)", fontStyle: "italic" }}>Wpisz dane</div>
                )}
              </div>

              {/* Pola finansowe — Zarobek tylko dla admina */}
              <div style={{ background: "var(--card)", padding: 8, borderRadius: 10, border: "1px solid var(--line)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 8px", alignItems: "start" }}>
                <InlineEdit
                  label="Koszt (PLN)"
                  value={opp.cost !== undefined ? String(opp.cost) : ""}
                  placeholder="0"
                  onSave={(v) => {
                    const num = v ? parseFloat(v.replace(/,/g, ".")) : undefined;
                    if (num !== undefined && !isNaN(num)) {
                      save("cost", num);
                      if (opp.price !== undefined) save("profit", opp.price - num);
                    } else if (!v) save("cost", undefined);
                  }}
                />
                <InlineEdit
                  label="Cena (PLN)"
                  value={opp.price !== undefined ? String(opp.price) : ""}
                  placeholder="0"
                  onSave={(v) => {
                    const num = v ? parseFloat(v.replace(/,/g, ".")) : undefined;
                    if (num !== undefined && !isNaN(num)) {
                      save("price", num);
                      if (opp.cost !== undefined) save("profit", num - opp.cost);
                    } else if (!v) save("price", undefined);
                  }}
                />
                <InlineEdit
                  label="Dni montażu"
                  value={opp.workDays !== undefined ? String(opp.workDays) : ""}
                  placeholder="np. 2"
                  onSave={(v) => {
                    const num = v ? parseFloat(v.replace(/,/g, ".")) : undefined;
                    if (num !== undefined && !isNaN(num) && num >= 0) save("workDays", num);
                    else if (!v) save("workDays", undefined);
                  }}
                />
                {isAdmin && (
                  <InlineEdit
                    label="Zarobek (PLN)"
                    value={opp.profit !== undefined ? String(opp.profit) : ""}
                    placeholder="0"
                    onSave={(v) => {
                      const num = v ? parseFloat(v.replace(/,/g, ".")) : undefined;
                      if (num !== undefined && !isNaN(num)) save("profit", num);
                      else if (!v) save("profit", undefined);
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Usługi (styl jak w zleceniu) ── */}
      <div style={{ background: "var(--accent-soft)", borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 4, height: 20, borderRadius: 3, background: "var(--accent)", flexShrink: 0 }} />
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.527-.639.856-1.434.938-2.275L15.23 4.28a2.25 2.25 0 00-2.25-2.25H4.28a2.25 2.25 0 00-2.25 2.25v8.702c0 .841.329 1.636.938 2.275l3.03 2.496c.639.527 1.434.856 2.275.938L11.42 15.17z" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-strong)", textTransform: "uppercase", letterSpacing: 0.6 }}>
              Wybrane usługi
            </span>
          </div>
          <button
            type="button"
            onClick={startEditServices}
            title="Dodaj lub zarządzaj usługami"
            className="btn"
            style={{ fontSize: 11.5, padding: "5px 12px", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {selectedServices.length > 0 ? "Zarządzaj usługami" : "Dodaj usługi"}
          </button>
        </div>

        {/* Panel wyboru usług */}
        {servicesList.length > 0 && editingServices && (
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              border: "1px solid var(--accent-line)",
              background: "var(--accent-soft)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, color: "var(--accent)" }}>
              Wybierz usługi przypisane do tej szansy
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {Array.from(new Set([
                ...servicesList.map((s) => s.name),
                ...selectedServices
              ])).map((svcName) => {
                const active = draftServices.includes(svcName);
                return (
                  <button
                    key={svcName}
                    type="button"
                    onClick={() => toggleDraftService(svcName)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      fontSize: 12.5,
                      fontWeight: 600,
                      padding: "6px 12px 6px 8px",
                      borderRadius: 10,
                      border: active ? "1px solid var(--accent)" : "1px solid var(--line)",
                      background: active ? "var(--accent)" : "var(--card)",
                      color: active ? "#fff" : "var(--text-strong)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: active ? "rgba(255,255,255,0.2)" : "var(--panel-2)",
                        color: active ? "#fff" : "var(--text-mute)",
                        flexShrink: 0,
                      }}
                    >
                      <ServiceIcon name={svcName} />
                    </span>
                    {svcName}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={saveServices} className="btn primary btn-xs" style={{ padding: "5px 14px", fontSize: 11.5 }}>
                Zapisz usługi
              </button>
              <button onClick={cancelEditServices} className="btn btn-xs" style={{ padding: "5px 12px", fontSize: 11.5 }}>
                Anuluj
              </button>
            </div>
          </div>
        )}

        {/* Kafelki wybranych usług */}
        {selectedServices.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-mute)", padding: "16px", borderRadius: 10, background: "var(--panel-2)", border: "1px dashed var(--line)", textAlign: "center" }}>
            Brak przypisanych usług — kliknij <strong>„Dodaj usługi"</strong> powyżej, aby dodać zakres prac.
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {selectedServices.map((svcName) => (
              <div
                key={svcName}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 12.5,
                  fontWeight: 600,
                  padding: "6px 12px 6px 8px",
                  borderRadius: 10,
                  border: "1px solid var(--accent)",
                  background: "var(--accent)",
                  color: "#fff",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.2)",
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  <ServiceIcon name={svcName} />
                </span>
                {svcName}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Parametry konfiguratora (Zabudowa tarasu) ── */}
      {(isTerraceService || parsedConfig) && (
        <div style={{ background: "#F0FDFD", border: "1px solid #99F6E4", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "#0F766E", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
              <Sliders size={15} className="text-teal-600" />
              Parametry z konfiguratora (Zabudowa tarasu)
            </h3>
            <span style={{ fontSize: 10.5, fontWeight: 700, background: "#CCFBF1", color: "#0F766E", padding: "2px 8px", borderRadius: 12 }}>
              Formularz online
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {parsedConfig?.variant && (
              <div style={{ background: "#ffffff", border: "1px solid #CBD5E1", borderRadius: 6, padding: "8px 10px" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", display: "block" }}>Wybrany wariant</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A" }}>{parsedConfig.variant}</span>
              </div>
            )}
            {parsedConfig?.dimensions && (
              <div style={{ background: "#ffffff", border: "1px solid #CBD5E1", borderRadius: 6, padding: "8px 10px" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", display: "block" }}>Wymiary (Szer. x Głęb.)</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A" }}>{parsedConfig.dimensions}</span>
              </div>
            )}
            {parsedConfig?.area && (
              <div style={{ background: "#ffffff", border: "1px solid #CBD5E1", borderRadius: 6, padding: "8px 10px" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", display: "block" }}>Powierzchnia tarasu</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0F766E" }}>{parsedConfig.area}</span>
              </div>
            )}
            {parsedConfig?.location && (
              <div style={{ background: "#ffffff", border: "1px solid #CBD5E1", borderRadius: 6, padding: "8px 10px" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", display: "block" }}>Deklarowana miejscowość</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A" }}>{parsedConfig.location}</span>
              </div>
            )}
          </div>
          {parsedConfig?.options && (
            <div style={{ background: "#ffffff", border: "1px solid #CBD5E1", borderRadius: 6, padding: "8px 10px" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", display: "block" }}>Wyposażenie dodatkowe</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#1E293B" }}>{parsedConfig.options}</span>
            </div>
          )}
        </div>
      )}

      {/* ── 2-kolumnowy układ: Komentarz + Załączniki ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Komentarz klienta */}
        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 4, height: 18, borderRadius: 3, background: "#8b5cf6", flexShrink: 0 }} />
            <MessageSquare size={14} color="#8b5cf6" />
            <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--text-strong)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Komentarz / Uwagi klienta
            </span>
          </div>
          <textarea
            ref={commentRef}
            defaultValue={displayComment || opp.comment || ""}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = el.scrollHeight + "px";
            }}
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next !== (opp.comment ?? "")) {
                save("comment", next || undefined);
              }
            }}
            rows={4}
            placeholder="Uwagi klienta lub notatka wewnętrzna…"
            style={{
              width: "100%",
              resize: "none",
              overflow: "hidden",
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 12.5,
              color: "var(--text)",
              background: "var(--panel-2)",
              outline: "none",
              fontFamily: "inherit",
              lineHeight: 1.5,
            }}
          />
        </div>

        {/* Załączniki */}
        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 14 }}>
          <OpportunityAttachmentsSection
            opportunityId={opportunityId}
            opportunityFolderId={opp.opportunityFolderId}
          />
        </div>
      </div>

      {/* Modal Potwierdzenia usuwania */}
      {confirmDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            background: "rgba(15,23,42,0.5)",
          }}
          onClick={() => setConfirmDelete(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              padding: 20,
              maxWidth: 400,
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
              Usunąć szansę sprzedaży?
            </h3>
            <p style={{ fontSize: 12.5, color: "var(--text-mute)", margin: 0 }}>
              {"Operacja nieodwracalna. Je\u015bli chcesz tylko schowa\u0107 szans\u0119 z listy, u\u017cyj \u201eArchiwizuj\u201d."}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
              <button onClick={() => setConfirmDelete(false)} className="btn">
                Anuluj
              </button>
              <button
                onClick={() => {
                  setConfirmDelete(false);
                  void handleDelete();
                }}
                className="btn"
                style={{ background: "#ef4444", color: "#fff", borderColor: "#dc2626" }}
              >
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
