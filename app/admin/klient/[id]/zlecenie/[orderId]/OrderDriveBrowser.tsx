"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { createPortal } from "react-dom";

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

type PreviewFile = {
  name: string;
  url: string;
  mimeType?: string;
};

function isPreviewable(file: DriveItem): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return (
    file.mimeType?.startsWith("image/") ||
    ["jpg", "jpeg", "png", "gif", "webp"].includes(ext) ||
    file.mimeType === "application/pdf" ||
    ext === "pdf"
  );
}

function isImage(file: PreviewFile): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return (
    (file.mimeType?.startsWith("image/") ?? false) ||
    ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)
  );
}

function FolderIcon() {
  return (
    <svg
      style={{ width: 14, height: 14, flexShrink: 0, color: "#d97706" }}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
    </svg>
  );
}

function FileIcon({ mimeType, name }: { mimeType?: string; name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const cls = { width: 14, height: 14, flexShrink: 0 };

  if (
    mimeType?.startsWith("image/") ||
    ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)
  ) {
    return (
      <svg style={{ ...cls, color: "#10b981" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    );
  }
  if (mimeType === "application/pdf" || ext === "pdf") {
    return (
      <svg style={{ ...cls, color: "#ef4444" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    );
  }
  return (
    <svg style={{ ...cls, color: "#94a3b8" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

/** Eye icon for preview button */
function EyeIcon() {
  return (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

/** Slide-in preview panel rendered via portal */
function FilePreviewPanel({
  file,
  side,
  onClose,
}: {
  file: PreviewFile;
  side: "left" | "right";
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation on mount
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      setTimeout(() => {
        if (document.querySelectorAll('[data-preview-panel="true"]').length === 0) {
          document.body.style.overflow = "";
        }
      }, 0);
    };
  }, []);

  const panelStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    bottom: 0,
    width: "45vw",
    zIndex: 600,
    background: "var(--panel, #fff)",
    borderLeft: side === "right" ? "1px solid var(--line)" : "none",
    borderRight: side === "left" ? "1px solid var(--line)" : "none",
    display: "flex",
    flexDirection: "column",
    boxShadow: side === "left"
      ? "6px 0 32px rgba(0,0,0,0.18)"
      : "-6px 0 32px rgba(0,0,0,0.18)",
    transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    ...(side === "left"
      ? {
          left: 0,
          transform: visible ? "translateX(0)" : "translateX(-100%)",
        }
      : {
          right: 0,
          transform: visible ? "translateX(0)" : "translateX(100%)",
        }),
  };

  return createPortal(
    <>
      <div style={panelStyle} data-preview-panel="true">
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderBottom: "1px solid var(--line)",
            flexShrink: 0,
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--text-strong)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
            title={file.name}
          >
            {file.name}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 11,
                color: "var(--accent)",
                textDecoration: "none",
                padding: "3px 8px",
                border: "1px solid var(--line)",
                borderRadius: 5,
              }}
            >
              Otwórz w Drive
            </a>
            <button
              onClick={onClose}
              title="Zamknij"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-mute)",
                padding: 4,
                display: "flex",
                alignItems: "center",
                borderRadius: 4,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--panel-2)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "#1e293b" }}>
          <iframe
            src={(() => {
              let u = file.url;
              if (u.includes("drive.google.com/file/d/") && u.includes("/view")) {
                u = u.split("/view")[0] + "/preview";
              }
              return u;
            })()}
            title={file.name}
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        </div>
      </div>
    </>,
    document.body,
  );
}

export default function OrderDriveBrowser({
  orderId,
  rootFolderId,
  previewSide = "right",
  onFolderChange,
  refreshKey,
  hideDropZone = false,
}: {
  orderId: Id<"orders">;
  rootFolderId: string | undefined;
  previewSide?: "left" | "right";
  onFolderChange?: (folder: { id: string; name: string }) => void;
  refreshKey?: number;
  hideDropZone?: boolean;
}) {
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const uploadFile = useAction(api.googleDrive.uploadManualOrderFile);
  const createFolder = useAction(api.googleDrive.createOrderFolderInDrive);
  const deleteFile = useAction(api.googleDrive.deleteFile);
  const listFolderContents = useAction(api.googleDrive.listOrderFolderContents);

  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>(
    rootFolderId ? [{ id: rootFolderId, name: "Folder zlecenia" }] : [],
  );
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderNameInputRef = useRef<HTMLInputElement>(null);

  const currentFolderId = breadcrumb[breadcrumb.length - 1]?.id;
  const currentFolderName = breadcrumb[breadcrumb.length - 1]?.name ?? "Folder zlecenia";

  useEffect(() => {
    if (currentFolderId && onFolderChange) {
      onFolderChange({ id: currentFolderId, name: currentFolderName });
    }
  }, [currentFolderId, currentFolderName, onFolderChange]);

  useEffect(() => {
    if (rootFolderId) {
      setBreadcrumb([{ id: rootFolderId, name: "Folder zlecenia" }]);
    } else {
      setBreadcrumb([]);
      setItems([]);
    }
  }, [rootFolderId]);

  useEffect(() => {
    if (!currentFolderId || !rootFolderId) return;
    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    listFolderContents({ orderId, folderId: currentFolderId })
      .then((result) => {
        if (!cancelled) {
          setItems(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFetchError(
            err instanceof Error ? err.message : "Błąd pobierania zawartości folderu",
          );
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolderId, refreshCounter, refreshKey, rootFolderId]);

  // Auto-focus folder name input when it appears
  useEffect(() => {
    if (showNewFolderInput) {
      folderNameInputRef.current?.focus();
    }
  }, [showNewFolderInput]);

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
      setUploads((prev) => [
        ...prev,
        { id: itemId, name: file.name, status: "uploading" },
      ]);

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
          orderId,
          storageId: storageId as Id<"_storage">,
          fileName: file.name,
          mimeType: file.type || undefined,
          targetFolderId: currentFolderId,
        });

        setUploads((prev) => prev.filter((u) => u.id !== itemId));
        setRefreshCounter((prev) => prev + 1);
      } catch (err) {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === itemId
              ? {
                  ...u,
                  status: "error",
                  error: err instanceof Error ? err.message : "Błąd",
                }
              : u,
          ),
        );
      }
    },
    [generateUploadUrl, uploadFile, orderId, currentFolderId],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (!rootFolderId) return;
      for (const file of Array.from(e.dataTransfer.files)) {
        void handleFile(file);
      }
    },
    [rootFolderId, handleFile],
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

  const handleCreateFolder = useCallback(async () => {
    const name = folderName.trim();
    if (!name || !currentFolderId) return;
    setCreatingFolder(true);
    setFolderError(null);
    try {
      await createFolder({ orderId, parentFolderId: currentFolderId, name });
      setShowNewFolderInput(false);
      setFolderName("");
      setRefreshCounter((prev) => prev + 1);
    } catch (err) {
      setFolderError(err instanceof Error ? err.message : "Błąd tworzenia folderu");
    } finally {
      setCreatingFolder(false);
    }
  }, [folderName, currentFolderId, createFolder, orderId]);

  const handleDeleteFile = useCallback(async (fileId: string) => {
    setConfirmingDeleteId(null);
    setDeletingFileId(fileId);
    setDeleteErrorMsg(null);
    try {
      await deleteFile({ fileId });
      setRefreshCounter((prev) => prev + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Błąd usuwania";
      setDeleteErrorMsg(msg);
      setTimeout(() => setDeleteErrorMsg(null), 4000);
    } finally {
      setDeletingFileId(null);
    }
  }, [deleteFile]);

  const folders = items.filter((i) => i.isFolder);
  const files = items.filter((i) => !i.isFolder);
  const isEmpty =
    folders.length === 0 && files.length === 0 && uploads.length === 0;
  const isAtRoot = breadcrumb.length <= 1;

  return (
    <>
      <section className="panel" style={{ overflow: "hidden" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <span className="up mute">Pliki zlecenia</span>
          {rootFolderId && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {!showNewFolderInput && (
                <button
                  onClick={() => setShowNewFolderInput(true)}
                  className="btn"
                  style={{ fontSize: 11 }}
                >
                  <svg
                    width="12"
                    height="12"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                  </svg>
                  Dodaj folder
                </button>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn"
                style={{ fontSize: 11 }}
              >
                <svg
                  width="12"
                  height="12"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
                Dodaj pliki
              </button>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Inline folder creation */}
        {showNewFolderInput && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid var(--line)",
              background: "var(--panel-2)",
            }}
          >
            <input
              ref={folderNameInputRef}
              type="text"
              placeholder="Nazwa folderu"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreateFolder();
                if (e.key === "Escape") { setShowNewFolderInput(false); setFolderName(""); setFolderError(null); }
              }}
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                fontSize: 12.5,
                background: "transparent",
                color: "var(--text)",
                fontFamily: "inherit",
              }}
            />
            <button
              onClick={() => { setShowNewFolderInput(false); setFolderName(""); setFolderError(null); }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-mute)",
                padding: 0,
                fontSize: 12,
                fontFamily: "inherit",
              }}
            >
              Anuluj
            </button>
            <button
              onClick={handleCreateFolder}
              disabled={creatingFolder || !folderName.trim()}
              className="btn"
              style={{ fontSize: 12, padding: "3px 10px" }}
            >
              {creatingFolder ? "Tworzenie…" : "Utwórz"}
            </button>
          </div>
        )}
        {folderError && (
          <p style={{ fontSize: 12, color: "#dc2626", margin: 0 }}>
            {folderError}
          </p>
        )}

        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {!rootFolderId && (
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
              Folder Google Drive nie istnieje. Utwórz go przyciskiem &quot;Utwórz folder&quot; powyżej.
            </p>
          )}

          {rootFolderId && (
            <>
              {/* Breadcrumb */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  flexWrap: "wrap",
                  padding: "5px 10px",
                  background: "var(--panel-2)",
                  borderRadius: 6,
                  border: "1px solid var(--line)",
                  fontSize: 12,
                }}
              >
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
                      padding: "0 6px 0 0",
                      fontSize: 12,
                      borderRight: "1px solid var(--line)",
                      marginRight: 4,
                    }}
                    title="Wróć"
                  >
                    <svg
                      width="12"
                      height="12"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 19.5L8.25 12l7.5-7.5"
                      />
                    </svg>
                  </button>
                )}

                {breadcrumb.map((entry, index) => {
                  const isLast = index === breadcrumb.length - 1;
                  return (
                    <span
                      key={entry.id}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      {index > 0 && (
                        <svg
                          width="10"
                          height="10"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                          style={{ color: "var(--line-2)", flexShrink: 0 }}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8.25 4.5l7.5 7.5-7.5 7.5"
                          />
                        </svg>
                      )}
                      {isLast ? (
                        <span
                          style={{ fontWeight: 600, color: "var(--text-strong)" }}
                        >
                          {entry.name}
                        </span>
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
                            fontFamily: "inherit",
                          }}
                        >
                          {entry.name}
                        </button>
                      )}
                    </span>
                  );
                })}

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
                    style={{
                      width: 13,
                      height: 13,
                      animation: loading ? "spin 1s linear infinite" : "none",
                    }}
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
                </button>
              </div>

              {/* Error */}
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

              {/* File/folder listing */}
              {!fetchError && (
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {/* Delete error toast */}
                  {deleteErrorMsg && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#dc2626",
                        background: "#fef2f2",
                        border: "1px solid #fca5a5",
                        borderRadius: 6,
                        padding: "6px 10px",
                      }}
                    >
                      {deleteErrorMsg}
                    </div>
                  )}

                  {/* Skeleton on initial load */}
                  {loading && items.length === 0 &&
                    [1, 2, 3].map((i) => (
                      <div
                        key={i}
                        style={{
                          height: 33,
                          borderRadius: 6,
                          background: "var(--panel-2)",
                          border: "1px solid var(--line)",
                          opacity: 0.5,
                        }}
                      />
                    ))}

                  {/* Folders */}
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0,
                        borderRadius: 6,
                        border: "1px solid var(--line)",
                        background: "var(--panel-2)",
                        fontSize: 12.5,
                        transition: "border-color 0.1s",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#fbbf24"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--line)"; }}
                    >
                      <button
                        onClick={() => navigateInto(folder)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 10px",
                          flex: 1,
                          color: "var(--text)",
                          textAlign: "left",
                          cursor: "pointer",
                          background: "none",
                          border: "none",
                          fontSize: "inherit",
                          fontFamily: "inherit",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fefce8"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                      >
                        <FolderIcon />
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {folder.name}
                        </span>
                        <svg
                          width="10"
                          height="10"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                          style={{ color: "var(--text-mute)", flexShrink: 0 }}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8.25 4.5l7.5 7.5-7.5 7.5"
                          />
                        </svg>
                      </button>
                      <span
                        style={{
                          width: 1,
                          height: 24,
                          background: "var(--line)",
                          flexShrink: 0,
                        }}
                      />
                      {deletingFileId === folder.id ? (
                        <span style={{ padding: "6px 10px", display: "flex", alignItems: "center" }}>
                          <svg style={{ width: 14, height: 14, color: "#3b82f6", animation: "spin 1s linear infinite" }} fill="none" viewBox="0 0 24 24">
                            <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        </span>
                      ) : confirmingDeleteId === folder.id ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", fontSize: 11 }}>
                          <span style={{ color: "#dc2626", whiteSpace: "nowrap" }}>Usunąć?</span>
                          <button
                            onClick={() => handleDeleteFile(folder.id)}
                            style={{
                              background: "#dc2626",
                              border: "none",
                              borderRadius: 4,
                              color: "#fff",
                              cursor: "pointer",
                              padding: "2px 6px",
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            Tak
                          </button>
                          <button
                            onClick={() => setConfirmingDeleteId(null)}
                            style={{
                              background: "#e2e8f0",
                              border: "none",
                              borderRadius: 4,
                              color: "#475569",
                              cursor: "pointer",
                              padding: "2px 6px",
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            Nie
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmingDeleteId(folder.id)}
                          title="Usuń folder"
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "#94a3b8",
                            padding: "6px 10px",
                            display: "flex",
                            alignItems: "center",
                            transition: "color 0.15s",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; (e.currentTarget as HTMLButtonElement).style.background = "#fef2f2"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                        >
                          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Files */}
                  {files.map((file) => (
                    <div
                      key={file.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid var(--line)",
                        background: "var(--panel-2)",
                        fontSize: 12.5,
                        transition: "border-color 0.1s",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#93c5fd"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--line)"; }}
                    >
                      {isPreviewable(file) && file.url ? (
                        <button
                          onClick={() => setPreviewFile({ name: file.name, url: file.url!, mimeType: file.mimeType })}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flex: 1,
                            overflow: "hidden",
                            color: "var(--text)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            textAlign: "left",
                            fontFamily: "inherit",
                            fontSize: "inherit",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#1d4ed8"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"; }}
                        >
                          <FileIcon mimeType={file.mimeType} name={file.name} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {file.name}
                          </span>
                        </button>
                      ) : (
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flex: 1,
                            overflow: "hidden",
                            color: "var(--text)",
                            textDecoration: "none",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#1d4ed8"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text)"; }}
                        >
                          <FileIcon mimeType={file.mimeType} name={file.name} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {file.name}
                          </span>
                        </a>
                      )}

                      <button
                        onClick={() => setConfirmingDeleteId(file.id)}
                        disabled={deletingFileId === file.id}
                        title="Usuń plik"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#94a3b8",
                          padding: 0,
                          display: "flex",
                          transition: "color 0.15s",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8"; }}
                      >
                        {deletingFileId === file.id ? (
                          <svg
                            style={{ width: 13, height: 13, color: "#3b82f6", animation: "spin 1s linear infinite" }}
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : confirmingDeleteId === file.id ? (
                          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                            <span style={{ color: "#dc2626", whiteSpace: "nowrap" }}>Usunąć?</span>
                            <span style={{ display: "flex", gap: 3 }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteFile(file.id); }}
                                style={{
                                  background: "#dc2626",
                                  border: "none",
                                  borderRadius: 4,
                                  color: "#fff",
                                  cursor: "pointer",
                                  padding: "2px 6px",
                                  fontSize: 11,
                                  fontWeight: 600,
                                }}
                              >
                                Tak
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(null); }}
                                style={{
                                  background: "#e2e8f0",
                                  border: "none",
                                  borderRadius: 4,
                                  color: "#475569",
                                  cursor: "pointer",
                                  padding: "2px 6px",
                                  fontSize: 11,
                                  fontWeight: 600,
                                }}
                              >
                                Nie
                              </button>
                            </span>
                          </span>
                        ) : (
                          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        )}
                      </button>
                    </div>
                  ))}

                  {/* Empty state */}
                  {!loading && isEmpty && (
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--text-mute)",
                        textAlign: "center",
                        padding: "8px 0",
                        margin: 0,
                      }}
                    >
                      Ten folder jest pusty
                    </p>
                  )}
                </div>
              )}

              {/* Upload progress */}
              {uploads.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
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
                        background: "var(--panel-2)",
                        fontSize: 12.5,
                      }}
                    >
                      {u.status === "uploading" ? (
                        <svg
                          style={{ width: 13, height: 13, color: "#3b82f6", animation: "spin 1s linear infinite" }}
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            style={{ opacity: 0.25 }}
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            style={{ opacity: 0.75 }}
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                      ) : (
                        <svg
                          style={{ width: 13, height: 13, color: "#ef4444" }}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                      )}
                      <span
                        style={{
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: "var(--text)",
                        }}
                      >
                        {u.name}
                      </span>
                      {u.status === "uploading" && (
                        <span style={{ fontSize: 11, color: "var(--text-mute)" }}>
                          Wysyłanie…
                        </span>
                      )}
                      {u.status === "error" && (
                        <>
                          <span
                            style={{
                              fontSize: 11,
                              color: "#dc2626",
                              maxWidth: 200,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {u.error}
                          </span>
                          <button
                            onClick={() =>
                              setUploads((prev) =>
                                prev.filter((x) => x.id !== u.id),
                              )
                            }
                            style={{
                              color: "var(--text-mute)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                              display: "flex",
                            }}
                          >
                            <svg
                              width="11"
                              height="11"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Drop zone */}
              {!hideDropZone && (
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
                  style={{
                    cursor: "pointer",
                    borderRadius: 8,
                    border: `2px dashed ${isDragging ? "#60a5fa" : "var(--line)"}`,
                    background: isDragging ? "#eff6ff" : "transparent",
                    padding: isEmpty ? "24px 16px" : "10px 16px",
                    textAlign: "center",
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                >
                  <svg
                    style={{
                      width: 18,
                      height: 18,
                      margin: "0 auto 4px",
                      color: isDragging ? "#60a5fa" : "var(--text-mute)",
                      display: "block",
                    }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                    />
                  </svg>
                  <p
                    style={{
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: isDragging ? "#2563eb" : "var(--text-mute)",
                      margin: 0,
                    }}
                  >
                    {isDragging ? "Upuść tutaj" : "Przeciągnij pliki lub kliknij"}
                  </p>
                  {!isAtRoot && !isDragging && (
                    <p
                      style={{
                        fontSize: 11,
                        color: "var(--text-mute)",
                        margin: "3px 0 0",
                      }}
                    >
                      Pliki trafią do: {breadcrumb[breadcrumb.length - 1]?.name}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Slide-in preview panel */}
      {previewFile && (
        <FilePreviewPanel
          file={previewFile}
          side={previewSide}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </>
  );
}
