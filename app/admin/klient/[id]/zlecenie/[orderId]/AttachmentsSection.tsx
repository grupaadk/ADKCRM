"use client";

import { useState, useCallback, useRef, type ReactNode } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type UploadItem = {
  id: string;
  name: string;
  status: "pending" | "uploading" | "error";
  error?: string;
};

function SectionCard({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
          {title}
        </h2>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function FileTypeIcon({ mimeType }: { mimeType?: string }) {
  const cls = "h-4 w-4 flex-shrink-0";
  if (mimeType?.startsWith("image/")) {
    return (
      <svg className={`${cls} text-emerald-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    );
  }
  if (mimeType === "application/pdf") {
    return (
      <svg className={`${cls} text-red-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    );
  }
  if (mimeType?.includes("spreadsheet") || mimeType === "text/csv") {
    return (
      <svg className={`${cls} text-green-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0c0 .621.504 1.125 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-17.25" />
      </svg>
    );
  }
  return (
    <svg className={`${cls} text-slate-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function formatSize(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function readEntry(
  entry: FileSystemEntry,
  parentPath: string,
): Promise<Array<{ file: File; folderPath: string }>> {
  if (entry.isFile) {
    return new Promise((resolve) => {
      (entry as FileSystemFileEntry).file(
        (file) => resolve([{ file, folderPath: parentPath }]),
        () => resolve([]),
      );
    });
  }

  if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const childPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
    const reader = dirEntry.createReader();
    const allEntries: FileSystemEntry[] = [];
    let batch: FileSystemEntry[];
    do {
      batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
        reader.readEntries(resolve, reject);
      });
      allEntries.push(...batch);
    } while (batch.length > 0);

    const results = await Promise.all(
      allEntries.map((child) => readEntry(child, childPath)),
    );
    return results.flat();
  }

  return [];
}

export default function AttachmentsSection({
  orderId,
  hasDriveFolder,
}: {
  orderId: Id<"orders">;
  hasDriveFolder: boolean;
}) {
  const attachments = useQuery(api.attachments.listByOrder, { orderId });
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const uploadAttachment = useAction(api.googleDrive.uploadOrderAttachment);
  const deleteAttachment = useAction(api.googleDrive.deleteOrderAttachment);
  const syncAttachments = useAction(api.googleDrive.syncOrderAttachments);

  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<
    { type: "success" | "error"; text: string } | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File, folderPath: string) => {
      const itemId = `${Date.now()}-${Math.random()}`;
      setUploads((prev) => [...prev, { id: itemId, name: file.name, status: "pending" }]);

      try {
        setUploads((prev) =>
          prev.map((u) => (u.id === itemId ? { ...u, status: "uploading" } : u)),
        );

        const uploadUrl = await generateUploadUrl();

        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const { storageId } = (await res.json()) as { storageId: string };

        await uploadAttachment({
          orderId,
          storageId: storageId as Id<"_storage">,
          fileName: file.name,
          mimeType: file.type || undefined,
          size: file.size,
          folderPath: folderPath || undefined,
        });

        setUploads((prev) => prev.filter((u) => u.id !== itemId));
      } catch (err) {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === itemId
              ? { ...u, status: "error", error: err instanceof Error ? err.message : "Błąd" }
              : u,
          ),
        );
      }
    },
    [generateUploadUrl, uploadAttachment, orderId],
  );

  const processItems = useCallback(
    async (items: DataTransferItemList) => {
      // Collect entries synchronously (DataTransfer data is lost after await)
      const entries: FileSystemEntry[] = [];
      const directFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind !== "file") continue;
        const entry = item.webkitGetAsEntry?.();
        if (entry) {
          entries.push(entry);
        } else {
          const f = item.getAsFile();
          if (f) directFiles.push(f);
        }
      }

      const allFiles: Array<{ file: File; folderPath: string }> = [];
      for (const f of directFiles) allFiles.push({ file: f, folderPath: "" });
      for (const entry of entries) {
        const files = await readEntry(entry, "");
        allFiles.push(...files);
      }

      for (const { file, folderPath } of allFiles) {
        await uploadFile(file, folderPath);
      }
    },
    [uploadFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (!hasDriveFolder) return;
      void processItems(e.dataTransfer.items);
    },
    [hasDriveFolder, processItems],
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      for (const file of Array.from(files)) {
        const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
        const folderPath = rel ? rel.split("/").slice(0, -1).join("/") : "";
        await uploadFile(file, folderPath);
      }
      e.target.value = "";
    },
    [uploadFile],
  );

  const handleSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const result = await syncAttachments({ orderId });
      const parts: string[] = [];
      if (result.added > 0) parts.push(`dodano: ${result.added}`);
      if (result.updated > 0) parts.push(`zaktualizowano: ${result.updated}`);
      if (result.removed > 0) parts.push(`usunięto: ${result.removed}`);
      setSyncMessage({
        type: "success",
        text: parts.length > 0 ? `Zsynchronizowano (${parts.join(", ")})` : "Brak zmian — wszystko jest aktualne",
      });
    } catch (err) {
      setSyncMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Błąd synchronizacji",
      });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 4000);
    }
  }, [isSyncing, syncAttachments, orderId]);

  const handleDelete = useCallback(
    async (attachmentId: Id<"orderAttachments">, name: string) => {
      if (!confirm(`Usuń załącznik "${name}"?`)) return;
      setDeleting(attachmentId);
      try {
        await deleteAttachment({ attachmentId });
      } finally {
        setDeleting(null);
      }
    },
    [deleteAttachment],
  );

  const isEmpty = (!attachments || attachments.length === 0) && uploads.length === 0;

  return (
    <SectionCard
      title="Załączniki"
      action={
        hasDriveFolder ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              title="Pobierz pliki dodane bezpośrednio do folderu na Google Drive"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSyncing ? (
                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              )}
              {isSyncing ? "Synchronizuję…" : "Odśwież z Drive"}
            </button>
            <button
              onClick={() => folderInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
              Dodaj folder
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Dodaj pliki
            </button>
          </div>
        ) : null
      }
    >
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
        // @ts-expect-error webkitdirectory is not in React's HTML types
        webkitdirectory=""
      />

      {/* Sync status banner */}
      {syncMessage && (
        <p
          className={`mb-4 rounded-lg border px-4 py-2 text-xs ${
            syncMessage.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {syncMessage.text}
        </p>
      )}

      {/* No Drive folder warning */}
      {!hasDriveFolder && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Folder zlecenia w Google Drive nie istnieje. Zmień status zlecenia (np.&nbsp;na&nbsp;&bdquo;Pomiar&rdquo;), aby automatycznie utworzyć folder.
        </p>
      )}

      {/* Attachment table */}
      {attachments && attachments.length > 0 && (
        <div className="mb-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 pr-4">
                  Nazwa
                </th>
                <th className="pb-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 pr-4">
                  Folder
                </th>
                <th className="pb-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 pr-4">
                  Rozmiar
                </th>
                <th className="pb-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 pr-4">
                  Data
                </th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {attachments.map((att) => (
                <tr
                  key={att._id}
                  className="group border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors"
                >
                  <td className="py-2.5 pr-4">
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 font-medium text-slate-700 hover:text-blue-600 transition-colors"
                    >
                      <FileTypeIcon mimeType={att.mimeType} />
                      <span className="max-w-[220px] truncate">{att.name}</span>
                      <svg
                        className="h-3.5 w-3.5 flex-shrink-0 text-slate-300 transition-colors group-hover:text-blue-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </a>
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-slate-400">
                    {att.folderPath ? (
                      <span className="flex items-center gap-1">
                        <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                        </svg>
                        {att.folderPath}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums text-xs text-slate-400">
                    {formatSize(att.size)}
                  </td>
                  <td className="py-2.5 pr-4 whitespace-nowrap text-xs text-slate-400">
                    {new Date(att.uploadedAt).toLocaleDateString("pl-PL")}
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => handleDelete(att._id, att.name)}
                      disabled={deleting === att._id}
                      className="rounded-md px-2 py-1 text-xs text-red-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 disabled:opacity-50"
                    >
                      {deleting === att._id ? (
                        <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload progress */}
      {uploads.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {uploads.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
            >
              {u.status === "uploading" || u.status === "pending" ? (
                <svg className="h-3.5 w-3.5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              <span className="flex-1 truncate text-slate-700">{u.name}</span>
              {u.status === "uploading" && (
                <span className="text-slate-400">Wysyłanie…</span>
              )}
              {u.status === "error" && (
                <span className="max-w-[200px] truncate text-red-500">{u.error}</span>
              )}
              {u.status === "error" && (
                <button
                  onClick={() => setUploads((prev) => prev.filter((x) => x.id !== u.id))}
                  className="ml-1 text-slate-400 hover:text-slate-600"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Drag & drop zone */}
      {hasDriveFolder && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed text-center transition-colors ${
            isDragging
              ? "border-blue-400 bg-blue-50"
              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
          } ${isEmpty ? "py-10" : "py-5"}`}
        >
          <div className="flex flex-col items-center gap-1.5">
            <svg
              className={`h-6 w-6 ${isDragging ? "text-blue-400" : "text-slate-300"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p
              className={`text-sm font-medium ${isDragging ? "text-blue-600" : "text-slate-400"}`}
            >
              {isDragging ? "Upuść tutaj" : "Przeciągnij pliki lub foldery"}
            </p>
            {!isDragging && (
              <p className="text-xs text-slate-300">lub kliknij, aby wybrać pliki</p>
            )}
          </div>
        </div>
      )}

      {/* Empty state without Drive folder */}
      {!hasDriveFolder && isEmpty && (
        <p className="text-sm italic text-slate-400">Brak załączników.</p>
      )}
    </SectionCard>
  );
}
