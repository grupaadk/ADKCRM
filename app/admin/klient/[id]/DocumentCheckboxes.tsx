"use client";

import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

// Legacy clientId prop kept for backward compat but orderId is preferred

const DOCUMENT_LABELS: Record<string, string> = {
  pomiar: "Pomiar",
  umowa: "Umowa",
  gwarancja_alco: "Gwarancja ALCO",
  rekojmia_adk: "Rekojmia ADK",
  odbior_inwestor: "Odbior inwestorski",
  protokol_montaz: "Protokol montazu",
  reklamacja: "Reklamacja",
};

const DOCUMENT_GROUPS: Array<{ title: string; keys: string[] }> = [
  {
    title: "Umowy i dokumenty handlowe",
    keys: ["pomiar", "umowa", "rekojmia_adk"],
  },
  {
    title: "Protokoly odbioru",
    keys: ["odbior_inwestor", "protokol_montaz"],
  },
  {
    title: "Gwarancje",
    keys: ["gwarancja_alco"],
  },
  {
    title: "Inne",
    keys: ["reklamacja"],
  },
];

type DocumentType =
  | "pomiar"
  | "umowa"
  | "gwarancja_alco"
  | "rekojmia_adk"
  | "odbior_inwestor"
  | "protokol_montaz"
  | "reklamacja";

interface DocumentEntry {
  enabled: boolean;
  url?: string;
  generatedAt?: number;
  error?: string;
  errorAt?: number;
  signatureStatus?: "signed" | "not_applicable";
}

interface ClientData {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  city?: string;
  postalCode?: string;
  street?: string;
  buildingNumber?: string;
}

interface OrderData {
  investmentStreet?: string;
  investmentBuildingNumber?: string;
  investmentPostalCode?: string;
  investmentCity?: string;
  invoicePlan?: { type?: "vat" | "advance_final"; advancePct?: number };
}

interface MissingFieldGroup {
  group: string;
  fields: string[];
}

interface DocumentCheckboxesProps {
  orderId: Id<"orders">;
  documents: Record<string, DocumentEntry>;
  warrantyDocs?: Record<string, DocumentEntry>;
  clientData?: ClientData;
  orderData?: OrderData;
}


function MissingDataModal({
  missingGroups,
  onConfirm,
  onCancel,
}: {
  missingGroups: MissingFieldGroup[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-start gap-4 p-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <svg
              className="h-5 w-5 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-slate-900">
              Brakujące dane
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Poniższe pola nie są uzupełnione. Dokument zostanie wygenerowany z
              pustymi wartościami w tych miejscach.
            </p>
          </div>
        </div>

        <div className="mx-6 mb-4 space-y-3">
          {missingGroups.map((g) => (
            <div
              key={g.group}
              className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3"
            >
              <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-amber-700">
                {g.group}
              </div>
              <ul className="space-y-1">
                {g.fields.map((f) => (
                  <li
                    key={f}
                    className="flex items-center gap-2 text-sm text-amber-800"
                  >
                    <span className="h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Anuluj
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
          >
            Generuj mimo to
          </button>
        </div>
      </div>
    </div>
  );
}

function getMissingFieldGroups(
  clientData?: ClientData,
  orderData?: OrderData,
): MissingFieldGroup[] {
  const groups: MissingFieldGroup[] = [];

  if (clientData) {
    const clientFields: string[] = [];
    if (!clientData.email?.trim()) clientFields.push("Email");
    if (!clientData.phone?.trim()) clientFields.push("Telefon");
    if (clientFields.length > 0)
      groups.push({ group: "Dane klienta", fields: clientFields });

    const addressFields: string[] = [];
    if (!clientData.street?.trim()) addressFields.push("Ulica");
    if (!clientData.postalCode?.trim()) addressFields.push("Kod pocztowy");
    if (!clientData.city?.trim()) addressFields.push("Miejscowość");
    if (addressFields.length > 0)
      groups.push({ group: "Adres klienta", fields: addressFields });
  }

  if (orderData) {
    const investFields: string[] = [];
    if (!orderData.investmentStreet?.trim()) investFields.push("Ulica");
    if (!orderData.investmentPostalCode?.trim())
      investFields.push("Kod pocztowy");
    if (!orderData.investmentCity?.trim()) investFields.push("Miejscowość");
    if (investFields.length > 0)
      groups.push({ group: "Adres inwestycji", fields: investFields });
  }

  return groups;
}

// Keys that use the legacy fixed `documents` field; all others use `warrantyDocs`
const LEGACY_DOCUMENT_KEYS = new Set([
  "pomiar", "umowa", "gwarancja_alco", "rekojmia_adk",
  "odbior_inwestor", "protokol_montaz", "faktura", "reklamacja",
]);

export default function DocumentCheckboxes({
  orderId,
  documents,
  warrantyDocs,
  clientData,
  orderData,
}: DocumentCheckboxesProps) {
  const toggleDocument = useMutation(api.orders.toggleDocument);
  const generateWarrantyDoc = useMutation(api.orders.generateWarrantyDoc);
  const removeWarrantyDoc = useMutation(api.orders.removeWarrantyDoc);
  const templates = useQuery(api.documentTemplates.list);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [pendingDocType, setPendingDocType] = useState<string | null>(null);
  const [pendingTemplateId, setPendingTemplateId] = useState<Id<"documentTemplates"> | undefined>(undefined);
  const [pendingIsWarranty, setPendingIsWarranty] = useState(false);
  const [pendingTemplateDocType, setPendingTemplateDocType] = useState<string | null>(null);
  const [blockingError, setBlockingError] = useState<string | null>(null);

  const missingGroups = getMissingFieldGroups(clientData, orderData);

  const templatesByKey = useMemo(() => {
    if (!templates) return {} as Record<string, typeof templates>;
    const map: Record<string, typeof templates> = {};
    for (const t of templates) {
      if (!map[t.key]) map[t.key] = [];
      map[t.key].push(t);
    }
    return map;
  }, [templates]);

  // Clear generating state when Convex confirms doc is done (url or error set)
  useEffect(() => {
    setGenerating((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const key of Object.keys(prev)) {
        const legacyDone = documents[key]?.url || documents[key]?.error;
        const warrantyDone = warrantyDocs?.[key]?.url || warrantyDocs?.[key]?.error;
        if (prev[key] && (legacyDone || warrantyDone)) {
          next[key] = false;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [documents, warrantyDocs]);

  async function doGenerate(docType: string, templateId?: Id<"documentTemplates">) {
    setGenerating((prev) => ({ ...prev, [docType]: true }));
    try {
      await toggleDocument({
        orderId,
        documentType: docType as DocumentType,
        enabled: true,
        templateId,
      });
    } catch (err) {
      setGenerating((prev) => ({ ...prev, [docType]: false }));
      const message = err instanceof Error ? err.message : "Wystąpił błąd podczas generowania dokumentu.";
      setBlockingError(message);
    }
  }

  async function doGenerateWarranty(key: string, templateId: Id<"documentTemplates">) {
    setGenerating((prev) => ({ ...prev, [key]: true }));
    try {
      await generateWarrantyDoc({ orderId, key, templateId });
    } catch {
      setGenerating((prev) => ({ ...prev, [key]: false }));
    }
  }

  function handleGenerate(docType: string) {
    if (docType === "pomiar") {
      if (!orderData?.investmentStreet?.trim() || !orderData?.investmentCity?.trim()) {
        setBlockingError("Przed wygenerowaniem dokumentu Pomiar uzupełnij adres inwestycji w zleceniu (ulica i miejscowość).");
        return;
      }
    }

    const keyTemplates = templatesByKey[docType]?.filter((t) => t.isActive && t.googleDriveFileId) ?? [];

    let selectedTemplateId: Id<"documentTemplates"> | undefined = keyTemplates[0]?._id;

    if (docType === "umowa" && keyTemplates.length > 1) {
      const isAdvanceFinal = orderData?.invoicePlan?.type === "advance_final";
      const targetName = isAdvanceFinal ? "Umowa_Zaliczka" : "Umowa_całość";
      const autoSelected = keyTemplates.find((t) => t.name === targetName);
      if (autoSelected) {
        selectedTemplateId = autoSelected._id;
      } else {
        setPendingTemplateDocType(docType);
        return;
      }
    } else if (keyTemplates.length > 1) {
      setPendingTemplateDocType(docType);
      return;
    }

    if (missingGroups.length > 0) {
      setPendingTemplateId(selectedTemplateId);
      setPendingDocType(docType);
    } else {
      void doGenerate(docType, selectedTemplateId);
    }
  }

  async function handleRemove(docType: string) {
    if (!LEGACY_DOCUMENT_KEYS.has(docType)) {
      await removeWarrantyDoc({ orderId, key: docType });
      return;
    }
    await toggleDocument({
      orderId,
      documentType: docType as DocumentType,
      enabled: false,
    });
  }

  return (
    <>
      {blockingError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setBlockingError(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-start gap-4 p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="h-5 w-5 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.948 3.374H4.645c-1.73 0-2.813-1.874-1.948-3.374l7.308-12.748c.866-1.5 3.032-1.5 3.898 0l7.308 12.748zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">
                  Nie można wygenerować dokumentu
                </h3>
                <p className="mt-1 text-sm text-slate-600">{blockingError}</p>
              </div>
            </div>
            <div className="border-t border-slate-100 px-6 py-4">
              <button
                onClick={() => setBlockingError(null)}
                className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingTemplateDocType && templatesByKey[pendingTemplateDocType] && (
        <TemplatePickerModal
          docType={pendingTemplateDocType}
          templates={templatesByKey[pendingTemplateDocType].filter((t) => t.isActive && t.googleDriveFileId)}
          onSelect={(templateId) => {
            const docType = pendingTemplateDocType;
            setPendingTemplateDocType(null);
            if (missingGroups.length > 0) {
              setPendingTemplateId(templateId);
              setPendingDocType(docType);
            } else {
              void doGenerate(docType, templateId);
            }
          }}
          onCancel={() => setPendingTemplateDocType(null)}
        />
      )}
      {pendingDocType && (
        <MissingDataModal
          missingGroups={missingGroups}
          onConfirm={() => {
            const docType = pendingDocType;
            const templateId = pendingTemplateId;
            const isWarranty = pendingIsWarranty;
            setPendingDocType(null);
            setPendingTemplateId(undefined);
            setPendingIsWarranty(false);
            if (isWarranty && templateId) {
              void doGenerateWarranty(docType, templateId);
            } else {
              void doGenerate(docType, templateId);
            }
          }}
          onCancel={() => setPendingDocType(null)}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column" }}>
        {DOCUMENT_GROUPS.map((group, groupIdx) => {
          const groupKeys = group.keys.filter((k) => k in documents);

          type RowItem = {
            rowId: string;
            docKey: string;
            label: string;
            singleTemplate?: NonNullable<typeof templates>[0];
            useWarrantyDocs: boolean;
          };

          const rowItems: RowItem[] = group.title === "Gwarancje"
            ? (() => {
                const legacyTpls = groupKeys.flatMap((k) =>
                  (templatesByKey[k] ?? []).filter((t) => t.isActive && !!t.googleDriveFileId)
                );
                const extraTpls = Object.entries(templatesByKey)
                  .filter(([k]) => k.startsWith("gwarancja_") && !LEGACY_DOCUMENT_KEYS.has(k))
                  .flatMap(([, tpls]) => (tpls ?? []).filter((t) => t.isActive && !!t.googleDriveFileId));
                const allTpls = [...legacyTpls, ...extraTpls];
                if (allTpls.length > 0) {
                  return allTpls.map((t) => ({
                    rowId: t._id,
                    docKey: t.key,
                    label: t.name,
                    singleTemplate: t,
                    useWarrantyDocs: !LEGACY_DOCUMENT_KEYS.has(t.key),
                  }));
                }
                return groupKeys.map((k) => ({
                  rowId: k, docKey: k, label: DOCUMENT_LABELS[k] ?? k, useWarrantyDocs: false,
                }));
              })()
            : groupKeys.map((k) => ({ rowId: k, docKey: k, label: DOCUMENT_LABELS[k] ?? k, useWarrantyDocs: false }));

          if (rowItems.length === 0) return null;

          return (
            <div key={group.title}>
              {/* Group header */}
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--text-mute)",
                  padding: groupIdx === 0 ? "0 0 4px" : "10px 0 4px",
                }}
              >
                {group.title}
              </div>

              {rowItems.map((item, itemIdx) => {
                const { rowId, docKey, label, singleTemplate, useWarrantyDocs } = item;
                const doc = useWarrantyDocs
                  ? (warrantyDocs?.[docKey] ?? { enabled: false })
                  : documents[docKey];
                const isGenerating = generating[docKey] === true;
                const activeTemplates = singleTemplate
                  ? [singleTemplate]
                  : (templatesByKey[docKey] ?? []).filter((t) => t.isActive && !!t.googleDriveFileId);
                const hasTemplate = activeTemplates.length > 0;
                const isGenerated = !!doc?.url;
                const hasError = !isGenerated && !!doc?.error;

                function handleGenerateRow() {
                  if (singleTemplate) {
                    if (missingGroups.length > 0) {
                      setPendingTemplateId(singleTemplate._id);
                      setPendingDocType(docKey);
                      setPendingIsWarranty(useWarrantyDocs);
                    } else if (useWarrantyDocs) {
                      void doGenerateWarranty(docKey, singleTemplate._id);
                    } else {
                      void doGenerate(docKey, singleTemplate._id);
                    }
                  } else {
                    handleGenerate(docKey);
                  }
                }

                const dotColor = isGenerated
                  ? "#22c55e"
                  : hasError
                    ? "#ef4444"
                    : isGenerating
                      ? "#3b82f6"
                      : "var(--line)";

                const statusText = isGenerating
                  ? "Generowanie…"
                  : isGenerated && doc.generatedAt
                    ? new Date(doc.generatedAt).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "2-digit" })
                    : hasError
                      ? "Błąd"
                      : !hasTemplate
                        ? "Brak szablonu"
                        : "";

                return (
                  <div
                    key={rowId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 0",
                      borderTop: itemIdx === 0 ? "1px solid var(--line)" : "none",
                      borderBottom: "1px solid var(--line)",
                    }}
                  >
                    {/* Status dot */}
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: dotColor,
                        flexShrink: 0,
                        border: isGenerated || hasError || isGenerating ? "none" : "1.5px solid #d1d5db",
                      }}
                    />

                    {/* Label */}
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 500,
                        flex: 1,
                        color: isGenerated ? "var(--text)" : "var(--text-dim)",
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {label}
                    </span>

                    {/* Status text */}
                    {statusText && (
                      <span
                        style={{
                          fontSize: 10.5,
                          color: isGenerated
                            ? "#15803d"
                            : hasError
                              ? "#dc2626"
                              : isGenerating
                                ? "#2563eb"
                                : "var(--text-mute)",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {statusText}
                      </span>
                    )}

                    {/* Error tooltip */}
                    {hasError && doc?.error && (
                      <span title={doc.error} style={{ cursor: "help", color: "#dc2626", fontSize: 11 }}>ⓘ</span>
                    )}

                    {/* Actions */}
                    {isGenerated ? (
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        {doc.signatureStatus === "signed" && (
                          <span style={{ fontSize: 10, color: "#15803d", fontWeight: 600 }}>✓ Podp.</span>
                        )}
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn"
                          style={{ fontSize: 10, padding: "2px 7px" }}
                        >
                          Otwórz
                        </a>
                        <button
                          onClick={() => void handleRemove(docKey)}
                          className="btn"
                          style={{ fontSize: 10, padding: "2px 6px", color: "var(--bad)" }}
                          title="Usuń dokument"
                        >
                          ✕
                        </button>
                      </div>
                    ) : hasTemplate ? (
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        <button
                          onClick={() => handleGenerateRow()}
                          disabled={isGenerating}
                          className="btn"
                          style={{ fontSize: 10, padding: "2px 7px", opacity: isGenerating ? 0.5 : 1 }}
                        >
                          {hasError ? "Ponów" : "Generuj"}
                        </button>
                        {hasError && (
                          <button
                            onClick={() => void handleRemove(docKey)}
                            disabled={isGenerating}
                            className="btn"
                            style={{ fontSize: 10, padding: "2px 6px", color: "var(--bad)", opacity: isGenerating ? 0.5 : 1 }}
                            title="Usuń dokument / anuluj błąd"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}

function TemplatePickerModal({
  docType,
  templates,
  onSelect,
  onCancel,
}: {
  docType: string;
  templates: Array<{ _id: Id<"documentTemplates">; name: string; key: string }>;
  onSelect: (templateId: Id<"documentTemplates">) => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-base font-bold text-slate-900">Wybierz szablon</h2>
        <p className="mt-1 text-sm text-slate-500">
          Dla dokumentu <span className="font-mono font-medium text-slate-700">{docType}</span> dostępnych jest kilka szablonów.
        </p>
        <div className="mt-4 space-y-2">
          {templates.map((t) => (
            <button
              key={t._id}
              onClick={() => onSelect(t._id)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-800 hover:border-slate-900 hover:bg-slate-50 transition-colors"
            >
              {t.name}
            </button>
          ))}
        </div>
        <button
          onClick={onCancel}
          className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-500 hover:bg-slate-50"
        >
          Anuluj
        </button>
      </div>
    </div>
  );
}
