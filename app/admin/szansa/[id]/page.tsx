"use client";

import { use, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { SERVICES } from "@/convex/schema";
import InlineEdit from "@/app/admin/klient/[id]/InlineEdit";
import AddressSearch, { type AddressData } from "@/components/AddressSearch";
import { useStatusLabel } from "@/components/StatusLabelsContext";
import { ArrowLeft, Archive, ArchiveRestore, Trash2, Send, FolderOpen } from "lucide-react";

const FIELD_LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-mute)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  display: "block",
  marginBottom: 4,
};

const WINDOW_COLORS = [
  "Złoty dąb",
  "Orzech",
  "Winchester",
  "Antracyt",
  "Biały",
  "Woodec Oak",
  "Niestandardowy",
];
const TERRACE_COLORS = ["Antracyt", "Brąz jasny", "Niestandardowy"];
const CONSTRUCTION_COLORS = ["Biały", "Antracyt", "Brązowy", "Niestandardowy"];
const SUN_TYPES = ["Rolety", "Żaluzje"];

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

const COLOR_SERVICES = new Set([
  "Okna",
  "Drzwi",
  "Brama",
  "Zabudowa tarasu",
  "Konstrukcja aluminiowa",
  "System przeciwsłoneczny",
]);

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

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <Link href="/admin/panel" style={{ fontSize: 13, color: "var(--accent)" }}>Wróć do panelu</Link>
      </div>
    );
  }

  if (opp.processed) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 256, gap: 12 }}>
        <span className="mute" style={{ fontSize: 13 }}>
          Ta szansa została już przekonwertowana do zlecenia.
        </span>
        <Link href="/admin/panel" style={{ fontSize: 13, color: "var(--accent)" }}>
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
      router.push("/admin/panel");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd archiwizacji");
    }
  }

  async function handleDelete() {
    try {
      await deleteOpp({ opportunityId });
      router.push("/admin/panel");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd usuwania");
    }
  }

  const selectedServices = opp.services ?? [];
  const showColors = (s: string) => selectedServices.includes(s);

  const fileLinks = (opp.projectFiles ?? "")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => router.push("/admin/panel")}
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

        <div style={{ display: "flex", gap: 6 }}>
          {opp.clientFolderUrl && (
            <a
              href={opp.clientFolderUrl}
              target="_blank"
              rel="noreferrer"
              className="btn"
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              title="Otwórz folder Google Drive"
            >
              <FolderOpen size={13} /> Drive
            </a>
          )}
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

      {/* Usługi */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
          Usługi
        </h2>
        <ToggleGroup
          title="Wybrane usługi"
          options={SERVICES}
          selected={selectedServices}
          onChange={(next) => save("services", next.length > 0 ? next : undefined)}
        />
      </div>

      {/* Kolory */}
      {selectedServices.some((s) => COLOR_SERVICES.has(s)) && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
            Kolory i warianty
          </h2>
          {showColors("Okna") && (
            <ToggleGroup
              title="Kolor okien"
              options={WINDOW_COLORS}
              selected={opp.windowColor ?? []}
              onChange={(next) => save("windowColor", next.length > 0 ? next : undefined)}
            />
          )}
          {showColors("Drzwi") && (
            <ToggleGroup
              title="Kolor drzwi"
              options={WINDOW_COLORS}
              selected={opp.doorColor ?? []}
              onChange={(next) => save("doorColor", next.length > 0 ? next : undefined)}
            />
          )}
          {showColors("Brama") && (
            <ToggleGroup
              title="Kolor bramy"
              options={WINDOW_COLORS}
              selected={opp.gateColor ?? []}
              onChange={(next) => save("gateColor", next.length > 0 ? next : undefined)}
            />
          )}
          {showColors("Zabudowa tarasu") && (
            <ToggleGroup
              title="Kolor tarasu"
              options={TERRACE_COLORS}
              selected={opp.terraceColor ?? []}
              onChange={(next) => save("terraceColor", next.length > 0 ? next : undefined)}
            />
          )}
          {showColors("Konstrukcja aluminiowa") && (
            <ToggleGroup
              title="Kolor konstrukcji"
              options={CONSTRUCTION_COLORS}
              selected={opp.constructionColor ?? []}
              onChange={(next) => save("constructionColor", next.length > 0 ? next : undefined)}
            />
          )}
          {showColors("System przeciwsłoneczny") && (
            <ToggleGroup
              title="Typ systemu"
              options={SUN_TYPES}
              selected={opp.sunProtectionType ?? []}
              onChange={(next) => save("sunProtectionType", next.length > 0 ? next : undefined)}
            />
          )}
        </div>
      )}

      {/* Pliki projektowe (read-only z Jotforma) */}
      {fileLinks.length > 0 && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
            Pliki projektowe
          </h2>
          <ul style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, margin: 0, paddingLeft: 16 }}>
            {fileLinks.map((url) => (
              <li key={url}>
                <a
                  href={`/api/jotform/file?url=${encodeURIComponent(url)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--accent)", wordBreak: "break-all" }}
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Komentarz */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
          Komentarz klienta
        </h2>
        <textarea
          defaultValue={opp.comment ?? ""}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next !== (opp.comment ?? "")) {
              save("comment", next || undefined);
            }
          }}
          rows={4}
          placeholder="Dodatkowe uwagi…"
          style={{
            width: "100%",
            resize: "vertical",
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
