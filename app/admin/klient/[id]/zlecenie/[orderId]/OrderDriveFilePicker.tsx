"use client";

import { useState, useEffect, useCallback } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type BreadcrumbEntry = { id: string; name: string };

type DriveItem = {
  id: string;
  name: string;
  isFolder: boolean;
  url?: string;
  mimeType?: string;
};

export type SelectedFileItem = {
  id: string;
  name: string;
};

function FolderIcon() {
  return (
    <svg style={{ width: 15, height: 15, flexShrink: 0, color: "#d97706" }} fill="currentColor" viewBox="0 0 24 24">
      <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
    </svg>
  );
}

function FileIcon({ mimeType, name }: { mimeType?: string; name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const style = { width: 15, height: 15, flexShrink: 0 };

  if (mimeType?.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
    return (
      <svg style={{ ...style, color: "#10b981" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    );
  }
  if (mimeType === "application/pdf" || ext === "pdf") {
    return (
      <svg style={{ ...style, color: "#ef4444" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    );
  }
  return (
    <svg style={{ ...style, color: "#94a3b8" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

export default function OrderDriveFilePicker({
  orderId,
  rootFolderId,
  selectedFiles,
  onSelectionChange,
}: {
  orderId: Id<"orders">;
  rootFolderId: string | undefined;
  selectedFiles: Record<string, SelectedFileItem>;
  onSelectionChange: (updated: Record<string, SelectedFileItem>) => void;
}) {
  const listFolderContents = useAction(api.googleDrive.listOrderFolderContents);

  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>(
    rootFolderId ? [{ id: rootFolderId, name: "Folder zlecenia" }] : []
  );
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const currentFolder = breadcrumb[breadcrumb.length - 1];

  const fetchCurrentFolder = useCallback(async () => {
    if (!currentFolder) return;
    setLoading(true);
    setFetchError(null);
    try {
      const res = await listFolderContents({
        folderId: currentFolder.id,
        orderId,
      });
      setItems(res ?? []);
    } catch (e: any) {
      console.error("Błąd wczytywania folderu Drive:", e);
      setFetchError(e.message || "Błąd wczytywania zawartości folderu.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [currentFolder, listFolderContents, orderId]);

  useEffect(() => {
    fetchCurrentFolder();
  }, [fetchCurrentFolder]);

  function handleFolderClick(item: DriveItem) {
    setBreadcrumb((prev) => [...prev, { id: item.id, name: item.name }]);
  }

  function handleBreadcrumbClick(index: number) {
    setBreadcrumb((prev) => prev.slice(0, index + 1));
  }

  function handleFileToggle(item: DriveItem) {
    const isAlreadySelected = !!selectedFiles[item.id];
    const updated = { ...selectedFiles };
    if (isAlreadySelected) {
      delete updated[item.id];
    } else {
      updated[item.id] = { id: item.id, name: item.name };
    }
    onSelectionChange(updated);
  }

  function removeSelectedFile(id: string) {
    const updated = { ...selectedFiles };
    delete updated[id];
    onSelectionChange(updated);
  }

  const selectedList = Object.values(selectedFiles);

  return (
    <div className="flex flex-col gap-2 pt-3 border-t border-slate-200">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          Pliki z Google Drive do wysłania po API
        </label>
        {selectedList.length > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
            Zaznaczono {selectedList.length} {selectedList.length === 1 ? "pliki" : "plików"}
          </span>
        )}
      </div>

      {/* Nawigacja okruszkowa (Breadcrumb) */}
      <div className="flex items-center gap-1 text-xs bg-slate-100 p-2 rounded-md border border-slate-200 overflow-x-auto">
        {breadcrumb.map((b, idx) => {
          const isLast = idx === breadcrumb.length - 1;
          return (
            <div key={b.id} className="flex items-center gap-1 flex-shrink-0">
              {idx > 0 && <span className="text-slate-400 font-bold">/</span>}
              <button
                type="button"
                onClick={() => handleBreadcrumbClick(idx)}
                disabled={isLast}
                className={`text-xs font-semibold rounded px-1.5 py-0.5 transition-colors ${
                  isLast
                    ? "text-slate-900 bg-white shadow-sm font-bold border border-slate-200"
                    : "text-amber-700 hover:text-amber-900 hover:bg-slate-200"
                }`}
              >
                {idx === 0 ? `📁 ${b.name}` : b.name}
              </button>
            </div>
          );
        })}
      </div>

      {/* Lista plików i podfolderów */}
      {loading ? (
        <div className="text-xs text-slate-500 py-4 italic flex items-center justify-center gap-2 bg-slate-50 rounded-lg border border-slate-200">
          <span className="w-3.5 h-3.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
          Wczytywanie zawartości folderu…
        </div>
      ) : fetchError ? (
        <div className="text-xs text-rose-600 p-3 bg-rose-50 rounded-lg border border-rose-200">
          {fetchError}
        </div>
      ) : items.length === 0 ? (
        <div className="text-xs text-slate-400 p-3 italic bg-slate-50 rounded-lg border border-slate-200 text-center">
          Ten folder jest pusty.
        </div>
      ) : (
        <div className="flex flex-col gap-1 max-h-52 overflow-y-auto p-1.5 bg-slate-50 border border-slate-200 rounded-lg">
          {items.map((item) => {
            if (item.isFolder) {
              return (
                <div
                  key={item.id}
                  onClick={() => handleFolderClick(item)}
                  className="flex items-center justify-between p-2 bg-white hover:bg-amber-50/60 rounded border border-slate-200 text-xs font-semibold text-slate-800 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FolderIcon />
                    <span className="truncate">{item.name}</span>
                  </div>
                  <span className="text-[11px] text-amber-700 font-bold flex items-center gap-1">
                    Otwórz →
                  </span>
                </div>
              );
            }

            const isChecked = !!selectedFiles[item.id];
            return (
              <label
                key={item.id}
                className={`flex items-center gap-2.5 p-2 rounded border text-xs font-semibold transition-colors cursor-pointer ${
                  isChecked
                    ? "bg-amber-50/80 border-amber-300 text-slate-900"
                    : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleFileToggle(item)}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
                <FileIcon mimeType={item.mimeType} name={item.name} />
                <span className="truncate flex-1 min-w-0" title={item.name}>
                  {item.name}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {/* Podsumowanie wybranych plików do wysłania */}
      {selectedList.length > 0 && (
        <div className="flex flex-col gap-1.5 p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-lg mt-1">
          <div className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
            Wybrane pliki do wysłania po API ({selectedList.length}):
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {selectedList.map((f) => (
              <span
                key={f.id}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white text-slate-800 border border-emerald-300 px-2 py-0.5 rounded-full shadow-sm"
              >
                <span className="truncate max-w-[180px]" title={f.name}>{f.name}</span>
                <button
                  type="button"
                  onClick={() => removeSelectedFile(f.id)}
                  className="text-slate-400 hover:text-rose-600 font-bold text-xs"
                  title="Usuń z wysyłki"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
