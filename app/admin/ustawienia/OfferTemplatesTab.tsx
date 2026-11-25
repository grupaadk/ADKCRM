"use client";

import React, { useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Star,
  ExternalLink,
  Check,
  X,
  FolderOpen,
  Download,
  Loader2,
} from "lucide-react";

function extractGoogleDocId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const docMatch = trimmed.match(/\/(?:document|presentation|spreadsheets|file)\/d\/([a-zA-Z0-9_-]+)/);
  if (docMatch?.[1]) return docMatch[1];
  const openMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch?.[1]) return openMatch[1];
  return trimmed;
}

export default function OfferTemplatesTab() {
  const templates = useQuery(api.offerTemplates.list);
  const legacyCount = useQuery(api.offerTemplates.getLegacyServiceTemplatesCount);
  const driveConnection = useQuery(api.googleDrive.getConnectionStatus);

  const createTemplate = useMutation(api.offerTemplates.create);
  const updateTemplate = useMutation(api.offerTemplates.update);
  const removeTemplate = useMutation(api.offerTemplates.remove);
  const migrateFromServices = useMutation(api.offerTemplates.migrateFromServices);
  const listTemplateFiles = useAction(api.googleDrive.listTemplateFiles);

  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [googleDriveFileId, setGoogleDriveFileId] = useState("");
  const [description, setDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [driveFiles, setDriveFiles] = useState<Array<{ id: string; name: string }> | null>(null);
  const [driveFilesLoading, setDriveFilesLoading] = useState(false);
  const [driveSearch, setDriveSearch] = useState("");

  const [editingId, setEditingId] = useState<Id<"offerTemplates"> | null>(null);
  const [editDraft, setEditDraft] = useState({
    name: "",
    googleDriveFileId: "",
    description: "",
    isDefault: false,
  });

  const filteredDriveFiles = useMemo(() => {
    if (!driveFiles) return null;
    const q = driveSearch.trim().toLowerCase();
    if (!q) return driveFiles;
    return driveFiles.filter((f) => f.name.toLowerCase().includes(q));
  }, [driveFiles, driveSearch]);

  const handleLoadDriveFiles = async () => {
    setDriveFilesLoading(true);
    setError(null);
    try {
      const files = await listTemplateFiles();
      setDriveFiles(files);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się pobrać plików z Google Drive.");
    } finally {
      setDriveFilesLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !googleDriveFileId.trim()) {
      setError("Podaj nazwę szablonu oraz link lub ID pliku Google Drive.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await createTemplate({
        name: name.trim(),
        googleDriveFileId: extractGoogleDocId(googleDriveFileId),
        description: description.trim() || undefined,
        isDefault,
      });
      setName("");
      setGoogleDriveFileId("");
      setDescription("");
      setIsDefault(false);
      setShowAddForm(false);
      setNotice("Szablon oferty został dodany.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd podczas dodawania szablonu.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (tpl: NonNullable<typeof templates>[number]) => {
    setEditingId(tpl._id);
    setEditDraft({
      name: tpl.name,
      googleDriveFileId: tpl.googleDriveFileId,
      description: tpl.description ?? "",
      isDefault: Boolean(tpl.isDefault),
    });
    setError(null);
    setNotice(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    if (!editDraft.name.trim() || !editDraft.googleDriveFileId.trim()) {
      setError("Nazwa oraz ID pliku Google Drive są wymagane.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateTemplate({
        id: editingId,
        name: editDraft.name.trim(),
        googleDriveFileId: extractGoogleDocId(editDraft.googleDriveFileId),
        description: editDraft.description.trim(),
        isDefault: editDraft.isDefault,
      });
      setEditingId(null);
      setNotice("Zapisano zmiany w szablonie.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd podczas zapisu zmian.");
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (id: Id<"offerTemplates">) => {
    setError(null);
    try {
      await updateTemplate({ id, isDefault: true });
      setNotice("Zmieniono domyślny szablon oferty.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się ustawić domyślnego szablonu.");
    }
  };

  const handleDelete = async (id: Id<"offerTemplates">, tplName: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć szablon oferty „${tplName}”?`)) return;
    setError(null);
    try {
      await removeTemplate({ id });
      setNotice(`Usunięto szablon „${tplName}”.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd podczas usuwania szablonu.");
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    setError(null);
    setNotice(null);
    try {
      const res = await migrateFromServices({});
      setNotice(
        res.importedCount > 0
          ? `Zaimportowano ${res.importedCount} szablon(ów) z usług.`
          : "Wszystkie szablony z usług są już zaimportowane.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd podczas importu szablonów.");
    } finally {
      setMigrating(false);
    }
  };

  if (templates === undefined) {
    return <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Oferty PDF · Google Drive
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
            Szablony ofert
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Niezależna lista szablonów Google Docs / Slides / Office wybieranych przy kliknięciu „Generuj ofertę” w konfiguratorze CAD.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowAddForm((prev) => !prev);
            setError(null);
            setNotice(null);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-[#4ABBC3] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#35a3ab] transition-colors cursor-pointer shrink-0"
        >
          <Plus size={16} />
          <span>Dodaj szablon oferty</span>
        </button>
      </div>

      {legacyCount !== undefined && legacyCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div>
            Znaleziono <strong>{legacyCount}</strong>{" "}
            {legacyCount === 1 ? "szablon przypisany" : "szablony przypisane"} wcześniej do usług. Możesz przenieść je jednym kliknięciem do tej listy.
          </div>
          <button
            type="button"
            disabled={migrating}
            onClick={handleMigrate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60 cursor-pointer shrink-0"
          >
            {migrating ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            <span>Importuj szablony z usług</span>
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      {showAddForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Nowy szablon oferty</h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nazwa szablonu *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Szablon Zabudowa tarasu"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#4ABBC3] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Link lub ID pliku Google Drive (Docs / Slides / .docx) *
              </label>
              <input
                type="text"
                required
                value={googleDriveFileId}
                onChange={(e) => setGoogleDriveFileId(e.target.value)}
                placeholder="https://docs.google.com/document/d/... lub samo ID"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-[#4ABBC3] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Opis (opcjonalnie)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="np. Do ofert z zadaszeniem aluminiowym i szkłem przesuwnym"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#4ABBC3] focus:outline-none"
            />
          </div>

          {driveConnection?.templatesFolderId && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <FolderOpen size={14} className="text-[#0e7490]" />
                  Wybierz plik z folderu szablonów Google Drive
                </span>
                <button
                  type="button"
                  disabled={driveFilesLoading}
                  onClick={handleLoadDriveFiles}
                  className="text-xs font-semibold text-[#0e7490] hover:underline disabled:opacity-50 cursor-pointer"
                >
                  {driveFilesLoading ? "Ładowanie..." : driveFiles ? "Odśwież listę" : "Pobierz pliki z Drive"}
                </button>
              </div>
              {filteredDriveFiles && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={driveSearch}
                    onChange={(e) => setDriveSearch(e.target.value)}
                    placeholder="Szukaj pliku po nazwie..."
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-[#4ABBC3] focus:outline-none"
                  />
                  <div className="max-h-36 overflow-y-auto divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
                    {filteredDriveFiles.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-slate-500">Brak pasujących plików.</div>
                    ) : (
                      filteredDriveFiles.map((file) => (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => {
                            setGoogleDriveFileId(file.id);
                            if (!name.trim()) setName(file.name);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#f0fdff] flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <span className="truncate font-medium text-slate-800">{file.name}</span>
                          <span className="font-mono text-[10px] text-slate-400 shrink-0">Wybierz</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Ustaw jako domyślny szablon oferty</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#4ABBC3] px-4 py-2 text-sm font-semibold text-white hover:bg-[#35a3ab] disabled:opacity-60 cursor-pointer"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                <span>Zapisz szablon</span>
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {templates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <FileText size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-700">Brak zdefiniowanych szablonów ofert</p>
            <p className="mt-1 text-sm text-slate-500">
              Dodaj szablony Google Docs / Slides lub zaimportuj dotychczasowe z usług, aby wybierać je z listy podczas generowania oferty PDF.
            </p>
          </div>
        ) : (
          templates.map((tpl) => {
            const isEditing = editingId === tpl._id;
            return (
              <div
                key={tpl._id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs"
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Nazwa</label>
                        <input
                          type="text"
                          value={editDraft.name}
                          onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-[#4ABBC3] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Link lub ID pliku Google Drive
                        </label>
                        <input
                          type="text"
                          value={editDraft.googleDriveFileId}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, googleDriveFileId: e.target.value }))
                          }
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono focus:border-[#4ABBC3] focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Opis</label>
                      <input
                        type="text"
                        value={editDraft.description}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, description: e.target.value }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-[#4ABBC3] focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editDraft.isDefault}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, isDefault: e.target.checked }))
                          }
                        />
                        <span>Szablon domyślny</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                        >
                          Anuluj
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={handleSaveEdit}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#4ABBC3] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#35a3ab] disabled:opacity-60 cursor-pointer"
                        >
                          <Check size={13} />
                          <span>Zapisz</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <FileText size={16} className="text-[#0e7490] shrink-0" />
                        <span className="font-bold text-slate-900">{tpl.name}</span>
                        {tpl.isDefault && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(74,187,195,0.15)] px-2.5 py-0.5 text-[11px] font-bold text-[#0e7490]">
                            <Star size={11} className="fill-[#0e7490]" />
                            Domyślny
                          </span>
                        )}
                      </div>
                      {tpl.description && (
                        <p className="text-xs text-slate-500">{tpl.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="font-mono truncate max-w-[320px]">ID: {tpl.googleDriveFileId}</span>
                        <a
                          href={`https://drive.google.com/file/d/${tpl.googleDriveFileId}/view`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#0e7490] hover:underline font-medium shrink-0"
                        >
                          <span>Otwórz w Google Drive</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!tpl.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(tpl._id)}
                          title="Ustaw jako domyślny"
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-[#0e7490] cursor-pointer"
                        >
                          Ustaw domyślny
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => startEdit(tpl)}
                        title="Edytuj szablon"
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800 cursor-pointer"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(tpl._id, tpl.name)}
                        title="Usuń szablon"
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
