"use client";

import { useState, useCallback, useRef } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type UploadItem = {
  id: string;
  name: string;
  status: "uploading" | "error";
  error?: string;
};

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
  files,
  hasDriveFolder,
}: {
  opportunityId: Id<"pendingJotformSubmissions">;
  files: Array<{ name: string; url: string }>;
  hasDriveFolder: boolean;
}) {
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const uploadFile = useAction(api.googleDrive.uploadManualOpportunityFile);

  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
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
    [generateUploadUrl, uploadFile, opportunityId],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (!hasDriveFolder) return;
      for (const file of Array.from(e.dataTransfer.files)) {
        void handleFile(file);
      }
    },
    [hasDriveFolder, handleFile],
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

  const isEmpty = files.length === 0 && uploads.length === 0;

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
          Załączniki
        </h2>
        {hasDriveFolder && (
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

      {!hasDriveFolder && (
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
          Folder Google Drive nie istnieje. Utwórz go przyciskiem "Google Drive" powyżej, aby móc wgrywać pliki.
        </p>
      )}

      {files.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {files.map((file) => (
            <a
              key={file.url}
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
        </div>
      )}

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

      {hasDriveFolder && (
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
        </div>
      )}

      {!hasDriveFolder && isEmpty && (
        <p style={{ fontSize: 12, color: "var(--text-mute)", margin: 0, fontStyle: "italic" }}>
          Brak załączników.
        </p>
      )}
    </div>
  );
}
