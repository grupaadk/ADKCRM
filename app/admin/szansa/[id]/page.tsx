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
import { ArrowLeft, Archive, ArchiveRestore, Trash2, Send, MapPin, Building2, Tag, MessageSquare, DollarSign, Sliders, Layers } from "lucide-react";
import DriveFolderButton from "@/components/DriveFolderButton";
import OpportunityAttachmentsSection from "./OpportunityAttachmentsSection";
import OpportunityEmailThreadsSection from "./OpportunityEmailThreadsSection";

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

function ToggleGroup({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p style={FIELD_LABEL}>{title}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() =>
                onChange(
                  active ? selected.filter((v) => v !== opt) : [...selected, opt],
                )
              }
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 6,
                border: `1px solid ${active ? "#1d4ed8" : "var(--line)"}`,
                background: active ? "#2563eb" : "var(--panel)",
                color: active ? "#fff" : "var(--text)",
                cursor: "pointer",
                transition: "all 0.1s ease",
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
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

  function handleAddress(a: AddressData) {
    const patch: Record<string, string> = {};
    if (a.street) patch.street = a.street;
    if (a.buildingNumber) patch.buildingNumber = a.buildingNumber;
    if (a.postalCode) patch.postalCode = a.postalCode;
    if (a.city) patch.city = a.city;
    if (Object.keys(patch).length > 0) {
      void updateField({ opportunityId, ...patch });
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

  const mainAddressStr = [opp.street, opp.buildingNumber ? ` buildingNumber` : "", opp.postalCode, opp.city].filter(Boolean).join(" ").trim() || 
    [opp.street, opp.postalCode, opp.city].filter(Boolean).join(", ");
  const investmentAddressStr = [opp.investmentStreet, opp.investmentBuildingNumber ? ` buildingNumber` : "", opp.investmentPostalCode, opp.investmentCity].filter(Boolean).join(" ").trim() || 
    [opp.investmentStreet, opp.investmentPostalCode, opp.investmentCity].filter(Boolean).join(", ");

  const mainMapsUrl = mainAddressStr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mainAddressStr)}` : null;
  const investmentMapsUrl = investmentAddressStr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(investmentAddressStr)}` : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Top Navigation Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => router.push("/admin/panel?tab=opportunities")}
            className="btn"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", fontSize: 12 }}
            title="Wróć do panelu"
          >
            <ArrowLeft size={14} /> Panel
          </button>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-strong)", margin: 0, lineHeight: 1.2 }}>
              {opp.firstName} {opp.lastName}
            </h1>
            <p style={{ fontSize: 11.5, color: "var(--text-mute)", margin: "2px 0 0" }}>
              Szansa sprzedaży · {stageLabel}
              {opp.submissionId && ` · #${opp.submissionId}`}
              {opp.archived && " · ZARCHIWIZOWANA"}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Przypisana osoba */}
          {(() => {
            const assigneesArray = Array.from(new Set([
              ...(opp.assignedUserId ? [opp.assignedUserId] : []),
              ...(opp.assignedUserIds || [])
            ]));
            const assignedUsers = assigneesArray.map(id => assignableUsers.find((u) => u._id === id)).filter(Boolean);
            
            const assignedName = assignedUsers.length === 0
              ? null
              : assignedUsers.length === 1
              ? (assignedUsers[0]!.displayName ?? assignedUsers[0]!.login ?? "")
              : `${assignedUsers.length} osoby`;
            return (
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
                            void assignOpportunity({ opportunityId, assignedUserIds: assigneesArray.filter(id => id !== u._id) });
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
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fee2e2" }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}
                      >
                        Usuń przypisanie
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

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

      {/* Smukły Pasek Etapu Sprzedaży & Konwersji */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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

      {/* GŁÓWNY SMUKŁY UKŁAD 2-KOLUMNOWY */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 14 }}>
        
        {/* LEWA KOLUMNA: Konfigurator, Dane, Finanse, Usługi */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* DEDYKOWANE OBIEKTOWE ODPOWIEDZI Z KONFIGURATORA (DLA ZABUDOWY TARASU) */}
          {(isTerraceService || parsedConfig) && (
            <div style={{ background: "#F0FDFD", border: "1px solid #99F6E4", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
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

          {/* SMUKŁY KOMPAKTOWY BOX: DANE KONTAKTOWE + FINANSE + TEKST WŁASNY */}
          <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            
            {/* Sekcja Danych Klienta */}
            <div>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-strong)", margin: "0 0 8px 0", display: "flex", alignItems: "center", gap: 6 }}>
                <Building2 size={14} /> Dane klienta & Finanse
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                <InlineEdit
                  label="Imię"
                  value={opp.firstName}
                  onSave={(v) => save("firstName", v)}
                />
                <InlineEdit
                  label="Nazwisko"
                  value={opp.lastName}
                  onSave={(v) => save("lastName", v)}
                />
                <InlineEdit
                  label="E-mail"
                  value={opp.email ?? ""}
                  placeholder="—"
                  onSave={(v) => save("email", v || undefined)}
                />
                <InlineEdit
                  label="Telefon"
                  value={opp.phone ?? ""}
                  placeholder="—"
                  onSave={(v) => save("phone", v || undefined)}
                />
              </div>
            </div>

            <div style={{ height: 1, background: "var(--line)" }} />

            <div style={{ display: "grid", gridTemplateColumns: isAdmin ? "repeat(3, 1fr)" : "repeat(2, 1fr)", gap: 8 }}>
              <InlineEdit
                label="Koszt (PLN)"
                value={opp.cost !== undefined ? String(opp.cost) : ""}
                placeholder="0"
                onSave={(v) => {
                  const num = v ? parseFloat(v.replace(/,/g, ".")) : undefined;
                  if (num !== undefined && !isNaN(num)) {
                    save("cost", num);
                    if (opp.price !== undefined) save("profit", opp.price - num);
                  } else if (!v) {
                    save("cost", undefined);
                  }
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
                  } else if (!v) {
                    save("price", undefined);
                  }
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

            <div style={{ background: "var(--panel-2)", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)" }}>
              <InlineEdit
                label="Tekst własny (Identyfikator Kanban)"
                value={opp.customText ?? ""}
                placeholder="np. KOWALSKI – Zabudowa tarasu Mińsk"
                onSave={(v) => save("customText", v || undefined)}
              />
            </div>
          </div>

          {/* SMUKŁE WYBRANE USŁUGI */}
          <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: 12 }}>
            <ToggleGroup
              title="Wybrane usługi"
              options={serviceNames}
              selected={selectedServices}
              onChange={(next) => save("services", next.length > 0 ? next : undefined)}
            />
          </div>

          {/* KORESPONDENCJA GMAIL */}
          <OpportunityEmailThreadsSection
            clientEmail={opp.email}
            defaultEmail="aluminiumadk@gmail.com"
          />

        </div>

        {/* PRAWA KOLUMNA: Adresy, Załączniki */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          
          {/* NOWOCZESNE KOMPAKTOWE ADRESY (ZAMIESZKANIA I INWESTYCJI) */}
          <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-strong)", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
              <MapPin size={14} /> Lokalizacja i Adresy
            </h2>

            {/* Adres Zamieszkania / Klienta */}
            <div style={{ background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 6, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-strong)" }}>Adres Klienta</span>
                {mainMapsUrl && (
                  <a href={mainMapsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10.5, color: "#2563eb", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <MapPin size={11} /> Google Maps
                  </a>
                )}
              </div>
              <AddressSearch onSelect={handleAddress} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <InlineEdit label="Ulica" value={opp.street ?? ""} placeholder="—" onSave={(v) => save("street", v || undefined)} />
                <InlineEdit label="Nr bud. / mieszk." value={[opp.buildingNumber, opp.apartmentNumber].filter(Boolean).join("/")} placeholder="—" onSave={(v) => {
                  const parts = v ? v.split("/") : [];
                  save("buildingNumber", parts[0] || undefined);
                  save("apartmentNumber", parts[1] || undefined);
                }} />
                <InlineEdit label="Kod pocztowy" value={opp.postalCode ?? ""} placeholder="—" onSave={(v) => save("postalCode", v || undefined)} />
                <InlineEdit label="Miejscowość" value={opp.city ?? ""} placeholder="—" onSave={(v) => save("city", v || undefined)} />
              </div>
            </div>

            {/* Adres Inwestycji */}
            <div style={{ background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: 6, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#0F172A" }}>Adres Inwestycji (Montażu)</span>
                {investmentMapsUrl && (
                  <a href={investmentMapsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10.5, color: "#0284C7", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <MapPin size={11} /> Google Maps
                  </a>
                )}
              </div>
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
            </div>
          </div>

          {/* SMUKŁY KOMENTARZ KLIENTA */}
          <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            <h2 style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-strong)", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
              <MessageSquare size={14} /> Komentarz / Uwagi klienta
            </h2>
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
              rows={2}
              placeholder="Uwagi klienta lub notatka wewnętrzna…"
              style={{
                width: "100%",
                resize: "none",
                overflow: "hidden",
                border: "1px solid var(--line)",
                borderRadius: 6,
                padding: "6px 8px",
                fontSize: 12,
                color: "var(--text)",
                background: "var(--panel)",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* ZAŁĄCZNIKI */}
          <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: 12 }}>
            <OpportunityAttachmentsSection
              opportunityId={opportunityId}
              opportunityFolderId={opp.opportunityFolderId}
            />
          </div>

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
              {"Operacja nieodwracalna. Jeśli chcesz tylko schować szansę z listy, użyj „Archiwizuj”."}
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
