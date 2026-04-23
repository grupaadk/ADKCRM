"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { useParams } from "next/navigation";

const CLIENT_FIELDS = [
  { value: "firstName", label: "Imię" },
  { value: "lastName", label: "Nazwisko" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Telefon" },
  { value: "nip", label: "NIP" },
  { value: "city", label: "Klient — miasto" },
  { value: "postalCode", label: "Klient — kod pocztowy" },
  { value: "street", label: "Klient — ulica" },
  { value: "buildingNumber", label: "Klient — numer budynku" },
  { value: "apartmentNumber", label: "Klient — numer mieszkania" },
  { value: "address", label: "Klient — adres (legacy)" },
  { value: "investmentStreet", label: "Inwestycja — ulica" },
  { value: "investmentBuildingNumber", label: "Inwestycja — numer budynku" },
  { value: "investmentApartmentNumber", label: "Inwestycja — numer mieszkania" },
  { value: "investmentPostalCode", label: "Inwestycja — kod pocztowy" },
  { value: "investmentCity", label: "Inwestycja — miasto" },
  { value: "services", label: "Uslugi" },
  { value: "windowColor", label: "Kolor okien" },
  { value: "doorColor", label: "Kolor drzwi" },
  { value: "gateColor", label: "Kolor bramy" },
  { value: "terraceColor", label: "Kolor tarasu" },
  { value: "constructionColor", label: "Kolor konstrukcji" },
  { value: "sunProtectionType", label: "Typ ochrony" },
  { value: "comment", label: "Komentarz" },
  { value: "name", label: "Nr zlecenia" },
  { value: "estimateTotal", label: "Kwota wyceny (brutto)" },
  { value: "estimateNetTotal", label: "Kwota wyceny (netto)" },
  { value: "invoiceVatPct", label: "Faktura VAT — procent" },
  { value: "invoiceVatAmount", label: "Faktura VAT — kwota (brutto)" },
  { value: "invoiceVatNetAmount", label: "Faktura VAT — kwota (netto)" },
  { value: "invoiceAdvancePct", label: "Zaliczka — procent" },
  { value: "invoiceAdvanceAmount", label: "Zaliczka — kwota (brutto)" },
  { value: "invoiceAdvanceNetAmount", label: "Zaliczka — kwota (netto)" },
  { value: "invoiceFinalPct", label: "Faktura końcowa — procent" },
  { value: "invoiceFinalAmount", label: "Faktura końcowa — kwota (brutto)" },
  { value: "invoiceFinalNetAmount", label: "Faktura końcowa — kwota (netto)" },
  { value: "__today", label: "Dzisiejsza data" },
  { value: "__year", label: "Biezacy rok" },
  { value: "__empty", label: "Puste pole" },
] as const;

const SAMPLE_DATA: Record<string, string> = {
  firstName: "Jan",
  lastName: "Kowalski",
  email: "jan@example.com",
  phone: "+48 123 456 789",
  nip: "123-456-78-90",
  city: "Warszawa",
  postalCode: "00-001",
  street: "Przykladowa",
  buildingNumber: "10",
  apartmentNumber: "5",
  address: "ul. Przykladowa 10",
  investmentStreet: "Budowlana",
  investmentBuildingNumber: "5",
  investmentApartmentNumber: "",
  investmentPostalCode: "02-001",
  investmentCity: "Warszawa",
  services: "Okna, Drzwi",
  windowColor: "Bialy",
  doorColor: "Antracyt",
  gateColor: "Brazowy",
  terraceColor: "Szary",
  constructionColor: "Czarny",
  sunProtectionType: "Roleta",
  comment: "Prosze o szybki kontakt",
  name: "ZL/2026/001",
  estimateTotal: "12 000,00 zł",
  estimateNetTotal: "9 756,10 zł",
  invoiceVatPct: "100%",
  invoiceVatAmount: "12 000,00 zł",
  invoiceVatNetAmount: "9 756,10 zł",
  invoiceAdvancePct: "50%",
  invoiceAdvanceAmount: "6 000,00 zł",
  invoiceAdvanceNetAmount: "4 878,05 zł",
  invoiceFinalPct: "50%",
  invoiceFinalAmount: "6 000,00 zł",
  invoiceFinalNetAmount: "4 878,05 zł",
  __today: new Date().toLocaleDateString("pl-PL"),
  __year: String(new Date().getFullYear()),
  __empty: "",
};

type Mapping = { placeholder: string; field: string };

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function resolvePlaceholders(
  pattern: string,
  mappings: Mapping[],
  data: Record<string, string>,
) {
  let result = pattern;
  for (const mapping of mappings) {
    if (mapping.placeholder && mapping.field) {
      result = result.replaceAll(
        mapping.placeholder,
        data[mapping.field] ?? "",
      );
    }
  }
  return result.replace(/\{\{(\w+)\}\}/g, (match, key) => data[key] ?? match);
}

export default function TemplateEditorPage() {
  const params = useParams();
  const id = params.id as Id<"documentTemplates">;

  const template = useQuery(api.documentTemplates.getById, { id });
  const driveConnection = useQuery(api.googleDrive.getConnectionStatus);
  const updateTemplate = useMutation(api.documentTemplates.updateById);
  const listTemplateFiles = useAction(api.googleDrive.listTemplateFiles);
  const detectTemplatePlaceholders = useAction(
    api.googleDrive.detectTemplatePlaceholders,
  );

  const [name, setName] = useState("");
  const [fileNamePattern, setFileNamePattern] = useState("");
  const [googleDriveFileId, setGoogleDriveFileId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [saving, setSaving] = useState(false);
  const [detectingPlaceholders, setDetectingPlaceholders] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [availableFiles, setAvailableFiles] = useState<Array<{
    id: string;
    name: string;
  }> | null>(null);
  const [filesLoading, setFilesLoading] = useState(false);
  const [fileSearch, setFileSearch] = useState("");
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (template && !initialized) {
      setName(template.name);
      setFileNamePattern(template.fileNamePattern);
      setGoogleDriveFileId(template.googleDriveFileId ?? "");
      setIsActive(template.isActive);
      setMappings(template.fieldMappings.map((mapping) => ({ ...mapping })));
      setInitialized(true);
    }
  }, [template, initialized]);

  const fileNamePreview = useMemo(
    () => resolvePlaceholders(fileNamePattern, mappings, SAMPLE_DATA),
    [fileNamePattern, mappings],
  );

  const filteredFiles = useMemo(() => {
    if (!availableFiles) {
      return null;
    }

    const q = fileSearch.trim().toLowerCase();
    if (!q) {
      return availableFiles;
    }

    return availableFiles.filter((file) =>
      file.name.toLowerCase().includes(q),
    );
  }, [availableFiles, fileSearch]);

  const handleLoadTemplateFiles = async () => {
    setFilesLoading(true);
    setNotice(null);
    try {
      setAvailableFiles(await listTemplateFiles());
    } catch (error) {
      setNotice({
        type: "error",
        text: `Blad plikow: ${getErrorMessage(error, "Nieznany blad")}`,
      });
    } finally {
      setFilesLoading(false);
    }
  };

  const addMapping = () => {
    setMappings((current) => [...current, { placeholder: "", field: "" }]);
  };

  const addPresetMapping = (field: string) => {
    const placeholder = `{{${field.replace(/^__/, "")}}}`;
    setMappings((current) => {
      const exists = current.some(
        (mapping) =>
          mapping.placeholder === placeholder || mapping.field === field,
      );
      if (exists) {
        return current;
      }
      return [...current, { placeholder, field }];
    });
  };

  const insertPlaceholderIntoPattern = (placeholder: string) => {
    setFileNamePattern((current) =>
      current.trim().length === 0 ? placeholder : `${current}_${placeholder}`,
    );
  };

  const removeMapping = (index: number) => {
    setMappings((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  const updateMapping = (
    index: number,
    field: keyof Mapping,
    value: string,
  ) => {
    setMappings((current) =>
      current.map((mapping, currentIndex) =>
        currentIndex === index ? { ...mapping, [field]: value } : mapping,
      ),
    );
  };

  const handleSave = async () => {
    if (!name.trim() || !fileNamePattern.trim()) return;
    setSaving(true);
    setNotice(null);
    try {
      await updateTemplate({
        id,
        name: name.trim(),
        googleDriveFileId: googleDriveFileId.trim() || undefined,
        fileNamePattern: fileNamePattern.trim(),
        fieldMappings: mappings.filter(
          (mapping) => mapping.placeholder && mapping.field,
        ),
        isActive,
      });
      setNotice({ type: "success", text: "Szablon zostal zapisany." });
    } catch (error) {
      setNotice({
        type: "error",
        text: `Blad zapisu: ${getErrorMessage(error, "Nieznany blad")}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDetectPlaceholders = async () => {
    if (!googleDriveFileId.trim()) {
      setNotice({
        type: "error",
        text: "Najpierw wybierz plik Google Docs dla szablonu.",
      });
      return;
    }

    setDetectingPlaceholders(true);
    setNotice(null);

    try {
      const placeholders = await detectTemplatePlaceholders({
        documentFileId: googleDriveFileId.trim(),
      });

      setMappings((current) => {
        const next = [...current];

        for (const placeholder of placeholders) {
          const fieldKey = placeholder.replace(/^\{\{|\}\}$/g, "");
          const knownField = CLIENT_FIELDS.find(
            (field) => field.value.replace(/^__/, "") === fieldKey,
          );

          const exists = next.some(
            (mapping) => mapping.placeholder === placeholder,
          );
          if (!exists) {
            next.push({
              placeholder,
              field: knownField?.value ?? "",
            });
          }
        }

        return next;
      });

      setNotice({
        type: "success",
        text:
          placeholders.length > 0
            ? `Dodano ${placeholders.length} placeholderow z dokumentu.`
            : "Nie znaleziono placeholderow w dokumencie.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        text: `Blad odczytu dokumentu: ${getErrorMessage(error, "Nieznany blad")}`,
      });
    } finally {
      setDetectingPlaceholders(false);
    }
  };

  if (template === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <Link
            href="/admin/ustawienia"
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            &larr; Powrot do listy
          </Link>
          <div className="mt-4 h-10 w-80 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    );
  }

  if (template === null) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/ustawienia"
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          &larr; Powrot do listy
        </Link>
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <h1 className="text-2xl font-bold text-slate-900">
            Szablon nie znaleziony
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Szablon o podanym ID nie istnieje.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            href="/admin/ustawienia"
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            &larr; Powrot do listy
          </Link>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Template Editor
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">
            {name || template.name}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Klucz{" "}
            <span className="font-mono text-xs text-slate-700">{template.key}</span> ·
            wersja v{template.version}
          </p>
        </div>
        <button
          onClick={() => void handleSave()}
          disabled={saving || !name.trim() || !fileNamePattern.trim()}
          className="inline-flex items-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? "Zapisywanie..." : "Zapisz szablon"}
        </button>
      </div>

      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            notice.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Zrodlo dokumentu
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Podlacz plik z Google Drive i ustaw nazwe wynikowego
                  dokumentu.
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  isActive
                    ? "bg-green-50 text-green-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {isActive ? "Aktywny" : "Nieaktywny"}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Nazwa
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Szablon aktywny
                </label>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Google Drive File ID
                </label>
                <input
                  type="text"
                  value={googleDriveFileId}
                  onChange={(e) => setGoogleDriveFileId(e.target.value)}
                  placeholder="ID pliku na Google Drive"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
                {driveConnection?.templatesFolderId && (
                  <div className="mt-2 space-y-2">
                    <input
                      type="text"
                      value={fileSearch}
                      onChange={(e) => setFileSearch(e.target.value)}
                      placeholder="Szukaj pliku po nazwie..."
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => void handleLoadTemplateFiles()}
                      disabled={filesLoading}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                    >
                      {filesLoading
                        ? "Ladowanie plikow..."
                        : "Pobierz pliki z folderu szablonow"}
                    </button>
                    {filteredFiles && filteredFiles.length > 0 && (
                      <select
                        value={googleDriveFileId}
                        onChange={(e) => setGoogleDriveFileId(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="">Wybierz plik z Google Drive...</option>
                        {filteredFiles.map((file) => (
                          <option key={file.id} value={file.id}>
                            {file.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {filteredFiles && filteredFiles.length === 0 && (
                      <p className="text-xs text-slate-500">
                        Brak plikow pasujacych do wyszukiwania.
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Wzorzec nazwy pliku
                </label>
                <input
                  type="text"
                  value={fileNamePattern}
                  onChange={(e) => setFileNamePattern(e.target.value)}
                  placeholder="Pomiar_{{firstName}}_{{lastName}}_{{city}}"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
                <div className="mt-3 rounded-xl bg-slate-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Preview nazwy
                  </p>
                  <p className="mt-2 break-all font-mono text-sm text-slate-800">
                    {fileNamePreview}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Mapper pol</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Zmapuj placeholdery z dokumentu na pola klienta lub wartosci
                  specjalne.
                </p>
              </div>
              <button
                onClick={addMapping}
                className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Dodaj mapowanie
              </button>
              <button
                onClick={() => void handleDetectPlaceholders()}
                disabled={detectingPlaceholders || !googleDriveFileId.trim()}
                className="inline-flex items-center rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
              >
                {detectingPlaceholders
                  ? "Szukam placeholderow..."
                  : "Wykryj placeholdery z dokumentu"}
              </button>
            </div>

            {mappings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                Brak mapowan. Dodaj pierwszy placeholder, aby uruchomic
                automatyczne uzupelnianie dokumentu.
              </div>
            ) : (
              <div className="space-y-3">
                {mappings.map((mapping, index) => (
                  <div
                    key={`${mapping.placeholder}-${index}`}
                    className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                  >
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                        Placeholder
                      </label>
                      <input
                        type="text"
                        value={mapping.placeholder}
                        onChange={(e) =>
                          updateMapping(index, "placeholder", e.target.value)
                        }
                        placeholder="{{firstName}}"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                        Pole klienta
                      </label>
                      <select
                        value={mapping.field}
                        onChange={(e) =>
                          updateMapping(index, "field", e.target.value)
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="">Wybierz pole...</option>
                        {CLIENT_FIELDS.map((fieldOption) => (
                          <option
                            key={fieldOption.value}
                            value={fieldOption.value}
                          >
                            {fieldOption.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => removeMapping(index)}
                        className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        Usun
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900">Szybkie dodawanie</h2>
            <p className="mt-1 mb-4 text-sm text-slate-500">
              Kliknij pole, aby dodac do mappera lub nazwy pliku.
            </p>
            <div className="grid gap-2">
              {CLIENT_FIELDS.map((fieldOption) => (
                <div
                  key={fieldOption.value}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                >
                  <div>
                    <p className="text-xs font-medium text-slate-900">
                      {fieldOption.label}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                      {fieldOption.value}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => addPresetMapping(fieldOption.value)}
                      className="rounded px-1.5 py-1 text-[10px] font-semibold text-blue-600 hover:bg-blue-50"
                      title="Dodaj do mappera"
                    >
                      +mapper
                    </button>
                    <button
                      onClick={() =>
                        insertPlaceholderIntoPattern(
                          `{{${fieldOption.value.replace(/^__/, "")}}}`,
                        )
                      }
                      className="rounded px-1.5 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100"
                      title="Wstaw do wzorca nazwy"
                    >
                      +nazwa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900">Dane testowe</h2>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              {Object.entries(SAMPLE_DATA)
                .filter(([field]) => !field.startsWith("__"))
                .map(([field, value]) => (
                  <div
                    key={field}
                    className="flex gap-2 rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <span className="font-mono text-xs text-slate-500">
                      {field}
                    </span>
                    <span className="text-slate-700">{value}</span>
                  </div>
                ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
