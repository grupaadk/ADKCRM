"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useMutation, useAction } from "convex/react";
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

type UploadItem = {
  id: string;
  name: string;
  status: "uploading" | "error";
  error?: string;
};

function FolderIcon() {
  return (
    <svg className="h-3.5 w-3.5 flex-shrink-0 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
      <path d="M2.25 4.5A2.25 2.25 0 004.5 4.5h4.94l2.06 2.06c.38.38.9.6 1.44.6H19.5A2.25 2.25 0 0121.75 9.375v8.25A2.25 2.25 0 0119.5 19.875H4.5A2.25 2.25 0 012.25 17.625V6.75A2.25 2.25 0 014.5 4.5z" />
    </svg>
  );
}

function FileTypeIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext ?? "")) {
    return (
      <svg className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    );
  }
  if (ext === "pdf") {
    return (
      <svg className="h-3.5 w-3.5 flex-shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    );
  }
  return (
    <svg className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

export default function OpportunityAttachmentsSection({
  opportunityId,
  opportunityFolderId,
}: {
  opportunityId: Id<"pendingJotformSubmissions">;
  opportunityFolderId: string | undefined;
}) {
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const uploadFile = useAction(api.googleDrive.uploadManualOpportunityFile);
  const listFolderContents = useAction(api.googleDrive.listOpportunityFolderContents);

  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>(
    opportunityFolderId ? [{ id: opportunityFolderId, name: "Główny folder" }] : [],
  );
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentFolderId = breadcrumb[breadcrumb.length - 1]?.id;

  // Reset breadcrumb to root when opportunityFolderId changes (folder just created or fresh page load)
  useEffect(() => {
    if (opportunityFolderId) {
      setBreadcrumb([{ id: opportunityFolderId, name: "Główny folder" }]);
    } else {
      setBreadcrumb([]);
      setItems([]);
    }
  }, [opportunityFolderId]);

  // Fetch folder contents whenever current folder or refresh counter changes
  useEffect(() => {
    if (!currentFolderId || !opportunityFolderId) return;

    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    listFolderContents({ opportunityId, folderId: currentFolderId })
      .then((result) => {
        if (!cancelled) {
          setItems(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : "Błąd pobierania zawartości folderu");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolderId, refreshCounter, opportunityFolderId]);

  function navigateInto(folder: DriveItem) {
    setBreadcrumb((prev) => [...prev, { id: folder.id, name: folder.name }]);
  }

  function navigateTo(index: number) {
    setBreadcrumb((prev) => prev.slice(0, index + 1));
  }

  const handleFile = useCallback(
    async (file: File) => {
      if (!currentFolderId) return;
      const itemId = `${Date.now()}-${Math.random()}`;
      setUploads((prev) => [...prev, { id: itemId, name: file.name, status: "uploading" }]);

      try {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const { storageId } = (await res.json()) as { storageId: string };

        await uploadFile({
          opportunityId,
          storageId: storageId as Id<"_storage">,
          targetFolderId: currentFolderId,
        });

        setUploads((prev) => prev.filter((u) => u.id !== itemId));
        setRefreshCounter((prev) => prev + 1);
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
    [generateUploadUrl, uploadFile, opportunityId, currentFolderId],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (!opportunityFolderId) return;
      for (const file of Array.from(e.dataTransfer.files)) {
        void handleFile(file);
      }
    },
    [opportunityFolderId, handleFile],
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return;
      for (const file of Array.from(e.target.files)) {
        await handleFile(file);
      }
      e.target.value = "";
    },
    [handleFile],
  );

  const folders = items.filter((i) => i.isFolder);
  const files = items.filter((i) => !i.isFolder);
  const isEmpty = folders.length === 0 && files.length === 0 && uploads.length === 0;
  const isAtRoot = breadcrumb.length <= 1;

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
          Załączniki
        </h2>
        {opportunityFolderId && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Dodaj pliki
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {opportunityFolderId && (
        <>
          {/* Breadcrumb navigation */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              flexWrap: "wrap",
              padding: "6px 10px",
              background: "var(--bg)",
              borderRadius: 6,
              border: "1px solid var(--line)",
              fontSize: 12,
            }}
          >
            {/* Back button */}
            {!isAtRoot && (
              <button
                onClick={() => navigateTo(breadcrumb.length - 2)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-mute)",
                  padding: "0 4px 0 0",
                  fontSize: 12,
                  borderRight: "1px solid var(--line)",
                  marginRight: 4,
                }}
                title="Wróć do poprzedniego folderu"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
            )}

            {breadcrumb.map((entry, index) => {
              const isLast = index === breadcrumb.length - 1;
              return (
                <span key={entry.id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {index > 0 && (
                    <svg className="h-3 w-3 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  )}
                  {isLast ? (
                    <span style={{ fontWeight: 600, color: "var(--text-strong)" }}>{entry.name}</span>
                  ) : (
                    <button
                      onClick={() => navigateTo(index)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--accent)",
                        padding: 0,
                        fontSize: 12,
                      }}
                    >
                      {entry.name}
                    </button>
                  )}
                </span>
              );
            })}

            {/* Refresh button */}
            <button
              onClick={() => setRefreshCounter((prev) => prev + 1)}
              style={{
                marginLeft: "auto",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-mute)",
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
              }}
              title="Odśwież"
            >
              <svg
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
          </div>

          {/* Error state */}
          {fetchError && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                color: "#dc2626",
                borderRadius: 6,
                padding: "8px 12px",
                fontSize: 12,
              }}
            >
              {fetchError}
            </div>
          )}

          {/* Folder and file list — always visible; spinner in breadcrumb shows loading state */}
          {!fetchError && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              {/* Skeleton — only on initial empty load */}
              {loading && items.length === 0 && (
                <>
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      style={{
                        height: 34,
                        borderRadius: 6,
                        background: "var(--bg)",
                        border: "1px solid var(--line)",
                        opacity: 0.5,
                      }}
                    />
                  ))}
                </>
              )}

              {/* Folders */}
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => navigateInto(folder)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--line)",
                    background: "var(--bg)",
                    fontSize: 12.5,
                    color: "var(--text)",
                    textAlign: "left",
                    cursor: "pointer",
                    width: "100%",
                  }}
                  className="hover:border-yellow-300 hover:bg-yellow-50 transition-colors"
                >
                  <FolderIcon />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {folder.name}
                  </span>
                  <svg className="h-3 w-3 flex-shrink-0 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              ))}

              {/* Files */}
              {files.map((file) => (
                <a
                  key={file.id}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--line)",
                    background: "var(--bg)",
                    fontSize: 12.5,
                    color: "var(--text)",
                    textDecoration: "none",
                  }}
                  className="hover:border-blue-300 hover:text-blue-600 transition-colors"
                >
                  <FileTypeIcon name={file.name} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {file.name}
                  </span>
                  <svg className="h-3 w-3 flex-shrink-0 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              ))}

              {/* Empty state */}
              {!loading && isEmpty && (
                <p style={{ fontSize: 12, color: "var(--text-mute)", margin: "4px 0", textAlign: "center" }}>
                  Ten folder jest pusty
                </p>
              )}
            </div>
          )}

          {/* In-progress uploads */}
          {uploads.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {uploads.map((u) => (
                <div
                  key={u.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--line)",
                    background: "var(--bg)",
                    fontSize: 12.5,
                  }}
                >
                  {u.status === "uploading" ? (
                    <svg className="h-3.5 w-3.5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="h-3.5 w-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>
                    {u.name}
                  </span>
                  {u.status === "uploading" && (
                    <span style={{ fontSize: 11, color: "var(--text-mute)" }}>Wysyłanie…</span>
                  )}
                  {u.status === "error" && (
                    <>
                      <span style={{ fontSize: 11, color: "#dc2626", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {u.error}
                      </span>
                      <button
                        onClick={() => setUploads((prev) => prev.filter((x) => x.id !== u.id))}
                        style={{ color: "var(--text-mute)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              cursor: "pointer",
              borderRadius: 8,
              border: `2px dashed ${isDragging ? "#60a5fa" : "var(--line)"}`,
              background: isDragging ? "#eff6ff" : "transparent",
              padding: isEmpty ? "28px 16px" : "12px 16px",
              textAlign: "center",
              transition: "border-color 0.15s, background 0.15s",
            }}
          >
            <svg
              style={{ width: 20, height: 20, margin: "0 auto 6px", color: isDragging ? "#60a5fa" : "var(--text-mute)" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p style={{ fontSize: 13, fontWeight: 500, color: isDragging ? "#2563eb" : "var(--text-mute)", margin: 0 }}>
              {isDragging ? "Upuść tutaj" : "Przeciągnij pliki lub kliknij"}
            </p>
            {!isAtRoot && (
              <p style={{ fontSize: 11, color: "var(--text-mute)", margin: "4px 0 0" }}>
                Pliki zostaną dodane do bieżącego folderu
              </p>
            )}
          </div>
        </>
      )}

      {!opportunityFolderId && (
        <p
          style={{
            fontSize: 12,
            color: "#92400e",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 6,
            padding: "8px 12px",
            margin: 0,
          }}
        >
          Folder Google Drive nie istnieje. Utwórz go przyciskiem &quot;Google Drive&quot; powyżej, aby móc wgrywać pliki.
        </p>
      )}
    </div>
  );
}
