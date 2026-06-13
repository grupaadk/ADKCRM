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
import { ArrowLeft, Archive, ArchiveRestore, Trash2, Send } from "lucide-react";
import DriveFolderButton from "@/components/DriveFolderButton";
import OpportunityAttachmentsSection from "./OpportunityAttachmentsSection";
import TaskKanban from "@/components/TaskKanban";

const FIELD_LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: "var(--text-mute)",
  margin: 0,
  marginBottom: 4,
};

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
    <div className="space-y-2">
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
                fontSize: 12,
                fontWeight: 500,
                padding: "4px 10px",
                borderRadius: 6,
                border: `1px solid ${active ? "#1d4ed8" : "var(--line)"}`,
                background: active ? "#2563eb" : "var(--panel)",
                color: active ? "#fff" : "var(--text)",
                cursor: "pointer",
                transition: "background 0.1s, border-color 0.1s",
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

  function save<K extends string>(field: K, value: string | string[] | undefined) {
    void updateField({ opportunityId, [field]: value });
  }

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
      // Odczekaj chwilę, aby akcja się wykonała
      await new Promise((resolve) => setTimeout(resolve, 2000));
      // Przeładuj stronę
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd tworzenia folderu");
      setRetrying(false);
    }
  }

  const selectedServices = opp.services ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => router.push("/admin/panel?tab=opportunities")}
            className="btn"
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            title="Wróć do panelu"
          >
            <ArrowLeft size={14} /> Panel
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
              {opp.firstName} {opp.lastName}
            </h1>
            <p style={{ fontSize: 12, color: "var(--text-mute)", margin: "2px 0 0" }}>
              Szansa sprzedaży · {stageLabel}
              {opp.submissionId && ` · Jotform #${opp.submissionId}`}
              {opp.archived && " · ZARCHIWIZOWANA"}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Przypisana osoba */}
          {(() => {
            const assignedUser = opp.assignedUserId
              ? assignableUsers.find((u) => u._id === opp.assignedUserId)
              : null;
            const assignedName = assignedUser
              ? (assignedUser.displayName ?? assignedUser.login ?? "")
              : null;
            return (
              <div ref={assignDropdownRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setShowAssignDropdown((v) => !v)}
                  className="btn"
                  style={{
                    fontSize: 11,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    ...(assignedUser?.color
                      ? { borderColor: assignedUser.color + "80", color: assignedUser.color }
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
                          void assignOpportunity({ opportunityId, assignedUserId: u._id });
                          setShowAssignDropdown(false);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          width: "100%",
                          textAlign: "left",
                          padding: "6px 12px",
                          fontSize: 12,
                          background: opp.assignedUserId === u._id ? "var(--panel-2)" : "transparent",
                          border: "none",
                          borderBottom: "1px solid var(--line)",
                          cursor: "pointer",
                          color: "var(--text)",
                          fontFamily: "inherit",
                          fontWeight: opp.assignedUserId === u._id ? 600 : 400,
                        }}
                      >
                        {u.color && (
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: u.color, flexShrink: 0 }} />
                        )}
                        <span style={{ flex: 1 }}>{u.displayName ?? u.login}</span>
                        {opp.assignedUserId === u._id && (
                          <span style={{ fontSize: 10, color: "var(--text-mute)", flexShrink: 0 }}>aktualny</span>
                        )}
                      </button>
                    ))}
                    {/* Usuń przypisanie */}
                    {opp.assignedUserId && (
                      <button
                        onClick={() => {
                          void assignOpportunity({ opportunityId, assignedUserId: undefined });
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
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
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

      {/* Status switch */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={FIELD_LABEL}>Etap sprzedaży</p>
        <div style={{ display: "flex", gap: 6 }}>
          {(["lead", "inquiry"] as const).map((s) => {
            const active = stage === s;
            return (
              <button
                key={s}
                onClick={() => handleStageChange(s)}
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: `1px solid ${active ? "#1d4ed8" : "var(--line)"}`,
                  background: active ? "#2563eb" : "var(--panel)",
                  color: active ? "#fff" : "var(--text)",
                  cursor: "pointer",
                }}
              >
                {s === "lead" ? "Oferty" : "Oferta wysłana"}
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            paddingTop: 12,
            borderTop: "1px dashed var(--line)",
          }}
        >
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", margin: 0 }}>
              Utwórz zlecenie
            </p>
            <p style={{ fontSize: 11.5, color: "var(--text-mute)", margin: "2px 0 0" }}>
              {"Dostępne gdy etap = „Oferta wysłana”. Utworzy klienta, zlecenie w statusie „Do pomiarów” i folder Drive."}
            </p>
          </div>
          <button
            onClick={handleConvert}
            disabled={stage !== "inquiry" || converting}
            className="btn primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              opacity: stage !== "inquiry" || converting ? 0.5 : 1,
              cursor: stage !== "inquiry" || converting ? "not-allowed" : "pointer",
            }}
          >
            <Send size={13} />
            {converting ? "Tworzenie..." : "Utwórz zlecenie"}
          </button>
        </div>
      </div>

      {/* Dane kontaktowe */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
          Dane kontaktowe
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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

      {/* Lista zadań */}
      <TaskKanban opportunityId={opportunityId} />

      {/* Tekst własny */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
          Tekst własny
        </h2>
        <InlineEdit
          label="Tekst własny"
          value={opp.customText ?? ""}
          placeholder="np. Kowalski – okna salonu"
          onSave={(v) => save("customText", v || undefined)}
        />
        <p style={{ fontSize: 12, color: "var(--text-mute)", margin: 0 }}>Dodatkowy identyfikator widoczny na karcie kanban</p>
      </div>

      {/* Adres */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
          Adres
        </h2>
        <AddressSearch onSelect={handleAddress} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <InlineEdit
            label="Ulica"
            value={opp.street ?? ""}
            placeholder="—"
            onSave={(v) => save("street", v || undefined)}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <InlineEdit
              label="Nr budynku"
              value={opp.buildingNumber ?? ""}
              placeholder="—"
              onSave={(v) => save("buildingNumber", v || undefined)}
            />
            <InlineEdit
              label="Nr mieszk."
              value={opp.apartmentNumber ?? ""}
              placeholder="—"
              onSave={(v) => save("apartmentNumber", v || undefined)}
            />
          </div>
          <InlineEdit
            label="Kod pocztowy"
            value={opp.postalCode ?? ""}
            placeholder="—"
            onSave={(v) => save("postalCode", v || undefined)}
          />
          <InlineEdit
            label="Miejscowość"
            value={opp.city ?? ""}
            placeholder="—"
            onSave={(v) => save("city", v || undefined)}
          />
        </div>
      </div>

      {/* Adres inwestycji */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
            Adres inwestycji
          </h2>
          <p style={{ fontSize: 12, color: "var(--text-mute)", margin: "4px 0 0" }}>Lokalizacja montażu (jeśli różni się od adresu klienta)</p>
        </div>
        <AddressSearch onSelect={handleInvestmentAddress} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <InlineEdit
            label="Ulica"
            value={opp.investmentStreet ?? ""}
            placeholder="—"
            onSave={(v) => save("investmentStreet", v || undefined)}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <InlineEdit
              label="Nr budynku"
              value={opp.investmentBuildingNumber ?? ""}
              placeholder="—"
              onSave={(v) => save("investmentBuildingNumber", v || undefined)}
            />
            <InlineEdit
              label="Nr mieszk."
              value={opp.investmentApartmentNumber ?? ""}
              placeholder="—"
              onSave={(v) => save("investmentApartmentNumber", v || undefined)}
            />
          </div>
          <InlineEdit
            label="Kod pocztowy"
            value={opp.investmentPostalCode ?? ""}
            placeholder="—"
            onSave={(v) => save("investmentPostalCode", v || undefined)}
          />
          <InlineEdit
            label="Miejscowość"
            value={opp.investmentCity ?? ""}
            placeholder="—"
            onSave={(v) => save("investmentCity", v || undefined)}
          />
        </div>
      </div>

      {/* Usługi */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
          Usługi
        </h2>
        <ToggleGroup
          title="Wybrane usługi"
          options={serviceNames}
          selected={selectedServices}
          onChange={(next) => save("services", next.length > 0 ? next : undefined)}
        />
      </div>

      {/* Załączniki */}
      <OpportunityAttachmentsSection
        opportunityId={opportunityId}
        opportunityFolderId={opp.opportunityFolderId}
      />

      {/* Komentarz */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
          Komentarz klienta
        </h2>
        <textarea
          ref={commentRef}
          defaultValue={opp.comment ?? ""}
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
          rows={1}
          placeholder="Dodatkowe uwagi…"
          style={{
            width: "100%",
            resize: "none",
            overflow: "hidden",
            border: "1px solid var(--line)",
            borderRadius: 6,
            padding: "8px 10px",
            fontSize: 13,
            color: "var(--text)",
            background: "var(--panel)",
            outline: "none",
            fontFamily: "inherit",
          }}
        />
      </div>

      {/* Potwierdzenie usuwania */}
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
