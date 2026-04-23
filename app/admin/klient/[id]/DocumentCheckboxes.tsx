"use client";

import type { ReactNode } from "react";
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
}

interface MissingFieldGroup {
  group: string;
  fields: string[];
}

interface DocumentCheckboxesProps {
  orderId: Id<"orders">;
  documents: Record<string, DocumentEntry>;
  clientData?: ClientData;
  orderData?: OrderData;
}

function DocGroupSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
          {title}
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </section>
  );
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
    if (!clientData.buildingNumber?.trim()) addressFields.push("Nr budynku");
    if (!clientData.postalCode?.trim()) addressFields.push("Kod pocztowy");
    if (!clientData.city?.trim()) addressFields.push("Miejscowość");
    if (addressFields.length > 0)
      groups.push({ group: "Adres klienta", fields: addressFields });
  }

  if (orderData) {
    const investFields: string[] = [];
    if (!orderData.investmentStreet?.trim()) investFields.push("Ulica");
    if (!orderData.investmentBuildingNumber?.trim())
      investFields.push("Nr budynku");
    if (!orderData.investmentPostalCode?.trim())
      investFields.push("Kod pocztowy");
    if (!orderData.investmentCity?.trim()) investFields.push("Miejscowość");
    if (investFields.length > 0)
      groups.push({ group: "Adres inwestycji", fields: investFields });
  }

  return groups;
}

export default function DocumentCheckboxes({
  orderId,
  documents,
  clientData,
  orderData,
}: DocumentCheckboxesProps) {
  const toggleDocument = useMutation(api.orders.toggleDocument);
  const templates = useQuery(api.documentTemplates.list);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [pendingDocType, setPendingDocType] = useState<string | null>(null);
  const [pendingTemplateDocType, setPendingTemplateDocType] = useState<string | null>(null);

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

  // Clear generating state only when Convex confirms the document is done (url or error set)
  useEffect(() => {
    setGenerating((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const key of Object.keys(prev)) {
        if (prev[key] && (documents[key]?.url || documents[key]?.error)) {
          next[key] = false;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [documents]);

  async function doGenerate(docType: string, templateId?: Id<"documentTemplates">) {
    setGenerating((prev) => ({ ...prev, [docType]: true }));
    try {
      await toggleDocument({
        orderId,
        documentType: docType as DocumentType,
        enabled: true,
        templateId,
      });
      // Do NOT reset here — useEffect clears it when Convex returns url/error
    } catch {
      setGenerating((prev) => ({ ...prev, [docType]: false }));
    }
  }

  function handleGenerate(docType: string) {
    const keyTemplates = templatesByKey[docType]?.filter((t) => t.isActive && t.googleDriveFileId) ?? [];
    if (keyTemplates.length > 1) {
      setPendingTemplateDocType(docType);
      return;
    }
    if (missingGroups.length > 0) {
      setPendingDocType(docType);
    } else {
      void doGenerate(docType, keyTemplates[0]?._id);
    }
  }

  async function handleRemove(docType: string) {
    await toggleDocument({
      orderId,
      documentType: docType as DocumentType,
      enabled: false,
    });
  }

  return (
    <>
      {pendingTemplateDocType && templatesByKey[pendingTemplateDocType] && (
        <TemplatePickerModal
          docType={pendingTemplateDocType}
          templates={templatesByKey[pendingTemplateDocType].filter((t) => t.isActive && t.googleDriveFileId)}
          onSelect={(templateId) => {
            const docType = pendingTemplateDocType;
            setPendingTemplateDocType(null);
            if (missingGroups.length > 0) {
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
            setPendingDocType(null);
            void doGenerate(docType);
          }}
          onCancel={() => setPendingDocType(null)}
        />
      )}

      <div className="space-y-4">
        {DOCUMENT_GROUPS.map((group) => {
          const groupKeys = group.keys.filter((k) => k in documents);
          if (groupKeys.length === 0) return null;

          return (
            <DocGroupSection key={group.title} title={group.title}>
              {groupKeys.map((key) => {
                const doc = documents[key];
                const isGenerating = generating[key] === true;
                const keyTemplates = templatesByKey[key] ?? [];
                const template = keyTemplates[0] ?? null;
                const activeTemplates = keyTemplates.filter((t) => t.isActive && !!t.googleDriveFileId);
                const hasTemplate = activeTemplates.length > 0;
                const hasMultipleTemplates = activeTemplates.length > 1;
                const isExpanded = expandedTemplate === key;
                const isGenerated = !!doc?.url;
                const hasError = !isGenerated && !!doc?.error;

                return (
                  <div
                    key={key}
                    className={`flex flex-col rounded-xl border transition-colors ${
                      isGenerated
                        ? "border-emerald-200 bg-emerald-50"
                        : hasError
                          ? "border-red-200 bg-red-50"
                          : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    {/* Card header */}
                    <div className="flex items-start justify-between p-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                            isGenerated
                              ? "bg-emerald-500 text-white"
                              : hasError
                                ? "bg-red-500 text-white"
                                : "border-2 border-slate-300 bg-white"
                          }`}
                        >
                          {isGenerated && (
                            <svg
                              className="h-3 w-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                          {hasError && (
                            <svg
                              className="h-3 w-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                              />
                            </svg>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {DOCUMENT_LABELS[key] ?? key}
                          </div>
                          <div
                            className={`mt-0.5 text-xs ${
                              isGenerated
                                ? "text-emerald-700"
                                : hasError
                                  ? "text-red-600"
                                  : isGenerating
                                    ? "text-blue-600"
                                    : !hasTemplate
                                      ? "text-slate-400"
                                      : "text-slate-500"
                            }`}
                          >
                            {isGenerating
                              ? "Generowanie..."
                              : isGenerated && doc.generatedAt
                                ? new Date(doc.generatedAt).toLocaleDateString(
                                    "pl-PL",
                                  )
                                : hasError
                                  ? "Błąd generowania"
                                  : !hasTemplate
                                    ? "Brak szablonu"
                                    : "Nie wygenerowano"}
                          </div>
                        </div>
                      </div>

                      {template && (
                        <button
                          onClick={() =>
                            setExpandedTemplate(isExpanded ? null : key)
                          }
                          className={`rounded-lg p-1.5 transition-colors ${
                            isExpanded
                              ? "bg-slate-200 text-slate-600"
                              : "text-slate-300 hover:bg-slate-100 hover:text-slate-500"
                          }`}
                          title="Szczegoly szablonu"
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                            />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Error details */}
                    {hasError && doc?.error && (
                      <div className="mx-4 mb-1 rounded-lg border border-red-200 bg-white/60 px-3 py-2">
                        <p className="break-all text-[11px] leading-relaxed text-red-700">
                          {doc.error}
                        </p>
                      </div>
                    )}

                    {/* Card actions */}
                    <div className="mt-auto border-t border-black/5 px-4 py-3">
                      {isGenerated ? (
                        <div className="flex flex-col gap-2">
                          {doc.signatureStatus && (
                            <div>
                              {doc.signatureStatus === "signed" ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                                  </svg>
                                  Podpisany
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                  </svg>
                                  Nie dotyczy
                                </span>
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
                            >
                              <svg
                                className="h-3.5 w-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                                />
                              </svg>
                              Otworz
                            </a>
                            <button
                              onClick={() => handleRemove(key)}
                              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                              title="Usun dokument"
                            >
                              <svg
                                className="h-3.5 w-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : hasTemplate ? (
                        <button
                          onClick={() => handleGenerate(key)}
                          disabled={isGenerating}
                          className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            hasError
                              ? "bg-red-600 hover:bg-red-700"
                              : "bg-slate-900 hover:bg-slate-800"
                          }`}
                        >
                          {isGenerating ? (
                            <>
                              <svg
                                className="h-3.5 w-3.5 animate-spin"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                />
                              </svg>
                              Generowanie...
                            </>
                          ) : hasError ? (
                            <>
                              <svg
                                className="h-3.5 w-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                                />
                              </svg>
                              Spróbuj ponownie
                            </>
                          ) : (
                            <>
                              <svg
                                className="h-3.5 w-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                                />
                              </svg>
                              Generuj dokument
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="text-center text-xs italic text-slate-400">
                          Brak przypisanego szablonu
                        </div>
                      )}
                    </div>

                    {/* Expanded template details */}
                    {isExpanded && keyTemplates.length > 0 && (
                      <div className="rounded-b-xl border-t border-slate-200 bg-white/70 px-4 py-3 space-y-3">
                        {keyTemplates.map((t) => (
                          <div key={t._id} className="space-y-2 text-xs">
                            {keyTemplates.length > 1 && (
                              <p className="font-semibold text-slate-700">{t.name}</p>
                            )}
                            <div className="flex justify-between">
                              <span className="text-slate-500">Nazwa:</span>
                              <span className="font-medium text-slate-700">
                                {t.name}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Status:</span>
                              <span
                                className={
                                  t.isActive
                                    ? "font-medium text-emerald-600"
                                    : "font-medium text-red-500"
                                }
                              >
                                {t.isActive ? "Aktywny" : "Nieaktywny"}
                              </span>
                            </div>
                            {t.googleDriveFileId && (
                              <div className="flex justify-between gap-2">
                                <span className="shrink-0 text-slate-500">
                                  Drive ID:
                                </span>
                                <span className="truncate font-mono text-slate-600">
                                  {t.googleDriveFileId}
                                </span>
                              </div>
                            )}
                            {t.fieldMappings.length > 0 && (
                              <div>
                                <div className="mb-1 text-slate-500">
                                  Mapowania ({t.fieldMappings.length}):
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {t.fieldMappings.map((m) => (
                                    <span
                                      key={m.placeholder}
                                      className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600"
                                    >
                                      <span className="text-slate-400">
                                        {m.placeholder}
                                      </span>
                                      <span className="text-slate-300">→</span>
                                      <span>{m.field}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </DocGroupSection>
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
