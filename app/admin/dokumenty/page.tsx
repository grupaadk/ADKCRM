"use client";

import { useState, useRef } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Upload, CheckCircle, AlertCircle, Search, X } from "lucide-react";

const DOCUMENT_LABELS: Record<string, string> = {
  pomiar: "Pomiar",
  umowa: "Umowa",
  gwarancja_alco: "Gwarancja ALCO",
  rekojmia_adk: "Rekojmia ADK",
  odbior_inwestor: "Odbior inwestorski",
  protokol_montaz: "Protokol montazu",
  faktura: "Faktura",
  reklamacja: "Reklamacja",
};

const DOCUMENT_TYPES = Object.keys(DOCUMENT_LABELS);

const STATUS_LABELS: Record<string, string> = {
  lead: "Lead",
  inquiry: "Zapytanie",
  measurement: "Pomiar",
  offer: "Oferta",
  contract: "Umowa",
  production: "Produkcja",
  installation: "Montaz",
  completed: "Zakonczone",
  complaint: "Reklamacja",
};

type DocumentType =
  | "pomiar"
  | "umowa"
  | "gwarancja_alco"
  | "rekojmia_adk"
  | "odbior_inwestor"
  | "protokol_montaz"
  | "faktura"
  | "reklamacja";

export default function DodajDokumentPage() {
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<Id<"clients"> | null>(null);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<Id<"orders"> | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>("pomiar");
  const [file, setFile] = useState<File | null>(null);
  const [signatureStatus, setSignatureStatus] = useState<"signed" | "not_applicable" | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ ok: true; url: string } | { ok: false; error: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const uploadUserDocument = useAction(api.googleDrive.uploadUserDocument);

  const searchResults = useQuery(
    api.clients.search,
    clientSearch.trim().length >= 1 ? { searchTerm: clientSearch.trim() } : "skip",
  );

  const orders = useQuery(
    api.orders.listByClient,
    selectedClientId ? { clientId: selectedClientId } : "skip",
  );

  function selectClient(id: Id<"clients">, name: string) {
    setSelectedClientId(id);
    setSelectedClientName(name);
    setClientSearch(name);
    setShowClientDropdown(false);
    setSelectedOrderId(null);
  }

  function clearClient() {
    setSelectedClientId(null);
    setSelectedClientName("");
    setClientSearch("");
    setSelectedOrderId(null);
  }

  function getOrderLabel(order: { _id: Id<"orders">; name?: string; status: string; _creationTime: number }) {
    const date = new Date(order._creationTime).toLocaleDateString("pl-PL");
    const status = STATUS_LABELS[order.status] ?? order.status;
    return order.name ? `${order.name} (${status}, ${date})` : `${status} — ${date}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClientId || !selectedOrderId || !file || !signatureStatus) return;

    setUploading(true);
    setResult(null);

    try {
      const uploadUrl = await generateUploadUrl();

      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload do storage nie powiódł się: ${uploadResponse.status}`);
      }

      const { storageId } = await uploadResponse.json() as { storageId: Id<"_storage"> };

      const driveUrl = await uploadUserDocument({
        orderId: selectedOrderId,
        documentType,
        storageId,
        fileName: file.name,
        signatureStatus: signatureStatus!,
      });

      setResult({ ok: true, url: driveUrl });
      setFile(null);
      setSignatureStatus(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : "Nieznany błąd" });
    } finally {
      setUploading(false);
    }
  }

  const canSubmit = !!selectedClientId && !!selectedOrderId && !!file && !!signatureStatus && !uploading;

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dodaj dokument</h1>
        <p className="mt-1 text-sm text-gray-500">
          Wgraj podpisany dokument i podepnij go pod zlecenie.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client selector */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Klient
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <Search className="size-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value);
                if (selectedClientId && e.target.value !== selectedClientName) {
                  setSelectedClientId(null);
                  setSelectedClientName("");
                  setSelectedOrderId(null);
                }
                setShowClientDropdown(true);
              }}
              onFocus={() => setShowClientDropdown(true)}
              onBlur={() => setTimeout(() => setShowClientDropdown(false), 150)}
              placeholder="Szukaj po nazwisku..."
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-9 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {selectedClientId && (
              <button
                type="button"
                onClick={clearClient}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <X className="size-4" />
              </button>
            )}

            {showClientDropdown && searchResults && searchResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                {searchResults.map((client: NonNullable<typeof searchResults>[number]) => (
                  <button
                    key={client._id}
                    type="button"
                    onMouseDown={() => selectClient(client._id, `${client.firstName} ${client.lastName}`)}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50"
                  >
                    <span className="font-medium text-gray-900">
                      {client.firstName} {client.lastName}
                    </span>
                    {client.city && (
                      <span className="ml-2 text-gray-500">{client.city}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {showClientDropdown && clientSearch.trim().length >= 1 && searchResults?.length === 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-lg">
                Brak wyników dla &quot;{clientSearch}&quot;
              </div>
            )}
          </div>
        </div>

        {/* Order selector */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Zlecenie
          </label>
          <select
            value={selectedOrderId ?? ""}
            onChange={(e) => setSelectedOrderId(e.target.value as Id<"orders"> || null)}
            disabled={!selectedClientId}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">
              {!selectedClientId ? "Najpierw wybierz klienta" : "Wybierz zlecenie"}
            </option>
            {orders?.map((order) => (
              <option key={order._id} value={order._id}>
                {getOrderLabel(order)}
              </option>
            ))}
          </select>
          {selectedClientId && orders?.length === 0 && (
            <p className="mt-1 text-xs text-gray-500">Ten klient nie ma zleceń.</p>
          )}
        </div>

        {/* Document type selector */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Typ dokumentu
          </label>
          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as DocumentType)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {DOCUMENT_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        {/* Signature status */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Status podpisu <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-3">
            <label
              className={`flex flex-1 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                signatureStatus === "signed"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                  : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
              }`}
            >
              <input
                type="radio"
                name="signatureStatus"
                value="signed"
                checked={signatureStatus === "signed"}
                onChange={() => setSignatureStatus("signed")}
                className="sr-only"
              />
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                  signatureStatus === "signed"
                    ? "border-emerald-500 bg-emerald-500"
                    : "border-gray-400"
                }`}
              >
                {signatureStatus === "signed" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </span>
              <span className="text-sm font-medium">Podpisany</span>
            </label>
            <label
              className={`flex flex-1 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                signatureStatus === "not_applicable"
                  ? "border-slate-500 bg-slate-50 text-slate-800"
                  : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
              }`}
            >
              <input
                type="radio"
                name="signatureStatus"
                value="not_applicable"
                checked={signatureStatus === "not_applicable"}
                onChange={() => setSignatureStatus("not_applicable")}
                className="sr-only"
              />
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                  signatureStatus === "not_applicable"
                    ? "border-slate-500 bg-slate-500"
                    : "border-gray-400"
                }`}
              >
                {signatureStatus === "not_applicable" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </span>
              <span className="text-sm font-medium">Nie dotyczy</span>
            </label>
          </div>
        </div>

        {/* File upload */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Plik
          </label>
          <div
            className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 transition-colors ${
              file
                ? "border-blue-300 bg-blue-50"
                : "border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className={`mb-2 size-8 ${file ? "text-blue-500" : "text-gray-400"}`} />
            {file ? (
              <>
                <p className="text-sm font-medium text-blue-700">{file.name}</p>
                <p className="mt-0.5 text-xs text-blue-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-700">Kliknij, aby wybrać plik</p>
                <p className="mt-0.5 text-xs text-gray-500">PDF, obrazy lub inne dokumenty</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFile(f);
                setResult(null);
              }}
            />
          </div>
          {file && (
            <button
              type="button"
              onClick={() => {
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="mt-1 text-xs text-gray-500 hover:text-red-500"
            >
              Usuń plik
            </button>
          )}
        </div>

        {/* Result message */}
        {result && (
          <div
            className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm ${
              result.ok
                ? "bg-emerald-50 text-emerald-800"
                : "bg-red-50 text-red-800"
            }`}
          >
            {result.ok ? (
              <CheckCircle className="mt-0.5 size-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
            )}
            <div>
              {result.ok ? (
                <>
                  Dokument wgrany pomyślnie.{" "}
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline"
                  >
                    Otwórz w Drive
                  </a>
                </>
              ) : (
                result.error
              )}
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? (
            <>
              <svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Wgrywanie...
            </>
          ) : (
            <>
              <Upload className="size-4" />
              Wgraj dokument
            </>
          )}
        </button>
      </form>
    </div>
  );
}
