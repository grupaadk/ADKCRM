"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

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

export default function ComplaintPhotoSection({
  orderId,
  complaintId,
  complaintFolderId,
}: {
  orderId: Id<"orders">;
  complaintId: Id<"complaints">;
  complaintFolderId: string | undefined;
}) {
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const uploadFile = useAction(api.googleDrive.uploadManualOrderFile);
  const listFolderContents = useAction(api.googleDrive.listOrderFolderContents);
  const deleteFile = useAction(api.googleDrive.deleteFile);
  const requestComplaintFolderCreation = useMutation(api.complaints.requestComplaintFolderCreation);

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [createFolderError, setCreateFolderError] = useState<string | null>(null);
  const [folderCreated, setFolderCreated] = useState(false);

  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!complaintFolderId) return;
    let cancelled = false;
    setLoading(true);
    listFolderContents({ orderId, folderId: complaintFolderId })
      .then((result) => {
        if (!cancelled) {
          setItems(result.filter((i) => !i.isFolder));
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [complaintFolderId, refreshCounter, listFolderContents, orderId]);

  const handleFile = useCallback(async (file: File) => {
    if (!complaintFolderId) return;
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
        orderId,
        storageId: storageId as Id<"_storage">,
        fileName: file.name,
        mimeType: file.type || undefined,
        targetFolderId: complaintFolderId,
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
  }, [generateUploadUrl, uploadFile, orderId, complaintFolderId]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (!complaintFolderId) return;
      for (const file of Array.from(e.dataTransfer.files)) {
        void handleFile(file);
      }
    },
    [complaintFolderId, handleFile],
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

  const handleDelete = useCallback(async (fileId: string) => {
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

  const images = items.filter((i) =>
    i.mimeType?.startsWith("image/") ?? /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(i.name),
  );
  const otherFiles = items.filter((i) => !images.includes(i));
  const hasContent = images.length > 0 || otherFiles.length > 0 || uploads.length > 0;

  function imgSrc(fileId: string) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w600`;
  }

  function imgSrcFull(fileId: string) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;
  }

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
          Zdjęcia
        </h2>
        {complaintFolderId && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Dodaj zdjęcia
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {!complaintFolderId ? (
        <div style={{ fontSize: 12, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "8px 12px", margin: 0 }}>
          <p style={{ margin: "0 0 8px" }}>Folder reklamacji nie istnieje w Drive.</p>
          <button
            onClick={async () => {
              setCreatingFolder(true);
              setCreateFolderError(null);
              try {
                await requestComplaintFolderCreation({ complaintId, orderId });
                setFolderCreated(true);
                setTimeout(() => setFolderCreated(false), 6000);
              } catch (err) {
                setCreateFolderError(err instanceof Error ? err.message : "Błąd");
                setTimeout(() => setCreateFolderError(null), 4000);
              } finally {
                setCreatingFolder(false);
              }
            }}
            disabled={creatingFolder}
            style={{
              background: creatingFolder ? "#fcd34d" : "#f59e0b",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 600,
              cursor: creatingFolder ? "default" : "pointer",
            }}
          >
            {creatingFolder ? "Tworzenie..." : "Utwórz folder"}
          </button>
          {createFolderError && (
            <p style={{ margin: "8px 0 0", color: "#dc2626" }}>{createFolderError}</p>
          )}
          {folderCreated && (
            <p style={{ margin: "8px 0 0", color: "#15803d" }}>Folder został utworzony. Odśwież stronę aby zobaczyć zmiany.</p>
          )}
        </div>
      ) : (
        <>
          {deleteErrorMsg && (
            <div style={{ fontSize: 12, color: "#dc2626", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, padding: "6px 10px" }}>
              {deleteErrorMsg}
            </div>
          )}

          {loading && items.length === 0 && (
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} style={{ aspectRatio: "1", borderRadius: 6, background: "var(--bg)", opacity: 0.5 }} />
              ))}
            </div>
          )}

          {!loading && images.length === 0 && otherFiles.length === 0 && uploads.length === 0 && (
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
                padding: "32px 16px",
                textAlign: "center",
                transition: "border-color 0.15s, background 0.15s",
              }}
            >
              <svg
                style={{ width: 24, height: 24, margin: "0 auto 8px", color: isDragging ? "#60a5fa" : "var(--text-mute)", display: "block" }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p style={{ fontSize: 13, fontWeight: 500, color: isDragging ? "#2563eb" : "var(--text-mute)", margin: 0 }}>
                {isDragging ? "Upuść zdjęcia tutaj" : "Przeciągnij zdjęcia lub kliknij"}
              </p>
            </div>
          )}

          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {images.map((img, idx) => (
                <div
                  key={img.id}
                  style={{
                    position: "relative",
                    aspectRatio: "1",
                    borderRadius: 6,
                    overflow: "hidden",
                    border: "1px solid var(--line)",
                    background: "var(--bg)",
                  }}
                  className="group"
                >
                  <button
                    onClick={() => setLightboxIndex(idx)}
                    style={{
                      width: "100%",
                      height: "100%",
                      padding: 0,
                      border: "none",
                      cursor: "pointer",
                      background: "none",
                      display: "block",
                    }}
                  >
                    <img
                      src={imgSrc(img.id)}
                      alt={img.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = `https://drive.google.com/uc?id=${img.id}`;
                      }}
                    />
                  </button>
                  <div
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      display: "flex",
                      gap: 2,
                      opacity: 1,
                      transition: "opacity 0.15s",
                    }}
                  >
                    {confirmingDeleteId === img.id ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(0,0,0,0.75)", borderRadius: 4, padding: "2px 6px" }}>
                        <span style={{ fontSize: 11, color: "#fff", whiteSpace: "nowrap" }}>Usunąć?</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(img.id); }}
                          style={{ background: "#dc2626", border: "none", borderRadius: 3, color: "#fff", cursor: "pointer", padding: "1px 5px", fontSize: 10, fontWeight: 600 }}
                        >
                          Tak
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(null); }}
                          style={{ background: "rgba(255,255,255,0.3)", border: "none", borderRadius: 3, color: "#fff", cursor: "pointer", padding: "1px 5px", fontSize: 10, fontWeight: 600 }}
                        >
                          Nie
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(img.id); }}
                        style={{
                          background: "rgba(0,0,0,0.5)",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                          color: "#fff",
                          padding: 4,
                          display: "flex",
                          lineHeight: 0,
                        }}
                      >
                        {deletingFileId === img.id ? (
                          <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {otherFiles.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Inne pliki
              </span>
              {otherFiles.map((file) => (
                <div
                  key={file.id}
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
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "var(--text)",
                      textDecoration: "none",
                    }}
                  >
                    {file.name}
                  </a>
                  <button
                    onClick={() => setConfirmingDeleteId(file.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0, display: "flex" }}
                  >
                    {confirmingDeleteId === file.id ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11 }}>
                        <span style={{ color: "#dc2626" }}>Usunąć?</span>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(file.id); }} style={{ background: "#dc2626", border: "none", borderRadius: 3, color: "#fff", cursor: "pointer", padding: "1px 5px", fontSize: 10 }}>Tak</button>
                        <button onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(null); }} style={{ background: "#e2e8f0", border: "none", borderRadius: 3, color: "#475569", cursor: "pointer", padding: "1px 5px", fontSize: 10 }}>Nie</button>
                      </span>
                    ) : (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {uploads.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {uploads.map((u) => (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg)", fontSize: 12.5 }}>
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
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>{u.name}</span>
                  {u.status === "uploading" && <span style={{ fontSize: 11, color: "var(--text-mute)" }}>Wysyłanie…</span>}
                  {u.status === "error" && (
                    <>
                      <span style={{ fontSize: 11, color: "#dc2626", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{u.error}</span>
                      <button onClick={() => setUploads((prev) => prev.filter((x) => x.id !== u.id))} style={{ color: "var(--text-mute)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
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

          {hasContent && (
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
                padding: "12px 16px",
                textAlign: "center",
                transition: "border-color 0.15s, background 0.15s",
              }}
            >
              <p style={{ fontSize: 12, fontWeight: 500, color: isDragging ? "#2563eb" : "var(--text-mute)", margin: 0 }}>
                {isDragging ? "Upuść zdjęcia tutaj" : "Przeciągnij więcej zdjęć lub kliknij"}
              </p>
            </div>
          )}
        </>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && images[lightboxIndex] && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setLightboxIndex(null)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              background: "rgba(255,255,255,0.2)",
              border: "none",
              borderRadius: "50%",
              cursor: "pointer",
              color: "#fff",
              width: 40,
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
            }}
          >
            ✕
          </button>

          {lightboxIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
              style={{
                position: "absolute",
                left: 16,
                background: "rgba(255,255,255,0.2)",
                border: "none",
                borderRadius: "50%",
                cursor: "pointer",
                color: "#fff",
                width: 48,
                height: 48,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
              }}
            >
              ‹
            </button>
          )}

          <img
            src={imgSrcFull(images[lightboxIndex].id)}
            alt={images[lightboxIndex].name}
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              objectFit: "contain",
              borderRadius: 4,
            }}
            onClick={(e) => e.stopPropagation()}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = `https://drive.google.com/uc?id=${images[lightboxIndex].id}`;
            }}
          />

          {lightboxIndex < images.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
              style={{
                position: "absolute",
                right: 16,
                background: "rgba(255,255,255,0.2)",
                border: "none",
                borderRadius: "50%",
                cursor: "pointer",
                color: "#fff",
                width: 48,
                height: 48,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
              }}
            >
              ›
            </button>
          )}

          <span
            style={{
              position: "absolute",
              bottom: 16,
              color: "rgba(255,255,255,0.7)",
              fontSize: 13,
              background: "rgba(0,0,0,0.5)",
              padding: "4px 12px",
              borderRadius: 20,
            }}
          >
            {lightboxIndex + 1} / {images.length}
          </span>
        </div>
      )}
    </div>
  );
}
