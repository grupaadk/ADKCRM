"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { FolderOpen, Loader2 } from "lucide-react";

// Po utworzeniu szansy/zlecenia folder na Google Drive powstaje automatycznie
// w tle — to kilka osobnych wywołań API Drive (folder klienta → podfolder →
// folder + podfoldery), więc trwa zwykle ~10 s. W tym oknie pokazujemy
// nieklikalny stan "Tworzę folder…" zamiast przycisku, żeby nie sugerować, że
// trzeba kliknąć (folder i tak powstaje sam). Gdy pole z URL-em folderu się
// pojawi (reaktywnie przez useQuery) — przełączamy na link "Drive". Jeśli po
// oknie wciąż brak folderu, automat faktycznie zawiódł — wtedy pokazujemy
// przycisk do ręcznego utworzenia (fallback).
const CREATION_WINDOW_MS = 30_000;

export default function DriveFolderButton({
  folderUrl,
  createdAt,
  onCreate,
  busy = false,
  style,
}: {
  folderUrl?: string | null;
  createdAt: number;
  onCreate: () => void;
  busy?: boolean;
  style?: CSSProperties;
}) {
  const baseStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    ...style,
  };

  // Czy minęło już okno automatycznego tworzenia? Liczymy raz na starcie
  // (stare rekordy bez folderu od razu pokazują fallback, bez migotania),
  // a po upływie okna przełączamy stan timerem.
  const [windowElapsed, setWindowElapsed] = useState(
    () => Date.now() - createdAt >= CREATION_WINDOW_MS,
  );

  useEffect(() => {
    if (folderUrl || windowElapsed) return;
    // Okno jeszcze nie minęło (inicjalizator złapałby przypadek age >= okno),
    // więc czekamy do jego końca i wtedy pokazujemy fallback.
    const remaining = CREATION_WINDOW_MS - (Date.now() - createdAt);
    const t = setTimeout(() => setWindowElapsed(true), Math.max(0, remaining));
    return () => clearTimeout(t);
  }, [folderUrl, createdAt, windowElapsed]);

  if (folderUrl) {
    return (
      <a
        href={folderUrl}
        target="_blank"
        rel="noreferrer"
        className="btn"
        style={baseStyle}
        title="Otwórz folder Google Drive"
      >
        <FolderOpen size={13} /> Drive
      </a>
    );
  }

  const creating = !busy && !windowElapsed;

  if (creating) {
    return (
      <span
        className="btn"
        aria-busy="true"
        style={{ ...baseStyle, opacity: 0.7, cursor: "default" }}
        title="Folder Google Drive jest tworzony automatycznie…"
      >
        <Loader2 size={13} className="animate-spin" /> Tworzę folder…
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onCreate}
      disabled={busy}
      className="btn"
      style={baseStyle}
      title="Utwórz folder Google Drive"
    >
      <FolderOpen size={13} /> {busy ? "Tworzę…" : "Utwórz folder"}
    </button>
  );
}
