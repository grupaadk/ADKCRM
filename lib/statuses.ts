// Rejestr statusów zleceń — JEDNO źródło prawdy dla nazw, kolorów, kolejności
// i widoczności. Plik celowo NIE importuje niczego z `convex/server`,
// `convex/_generated/*` ani `convex/schema`, dzięki czemu może być importowany
// ZARÓWNO przez frontend (`@/lib/statuses`) JAK I backend Convex (`../lib/statuses`).

export type StatusKind = "opportunity" | "order";

export interface StatusDef {
  /** Stabilny klucz zapisywany w orders.status (np. "lead" lub "custom_..."). */
  key: string;
  /** Wyświetlana nazwa. */
  label: string;
  /** Pojedynczy kolor HEX (#rrggbb) — z niego wyprowadzamy style. */
  color: string;
  /** Kolejność kolumn / wierszy. */
  sortOrder: number;
  /** Ukryty z tablicy Kanban (np. "archived"). */
  hidden: boolean;
  /** Status bazowy (wbudowany) — nie można go usunąć. */
  isCore: boolean;
  /** Strona workflow: szansa sprzedaży vs zlecenie. Własne statusy = "order". */
  kind: StatusKind;
}

// 10 statusów bazowych. Nazwy opisowe (zgodne z wcześniejszym wyborem),
// kolory dobrane semantycznie (z nich wyliczamy jasne pigułki i nagłówki kolumn).
export const DEFAULT_STATUSES: StatusDef[] = [
  { key: "lead",         label: "Lead",                color: "#3b82f6", sortOrder: 0, hidden: false, isCore: true, kind: "opportunity" },
  { key: "inquiry",      label: "Oferta wysłana",      color: "#a855f7", sortOrder: 1, hidden: false, isCore: true, kind: "opportunity" },
  { key: "measurement",  label: "Do pomiarów",         color: "#f59e0b", sortOrder: 2, hidden: false, isCore: true, kind: "order" },
  { key: "offer",        label: "Oferta po pomiarze",  color: "#f97316", sortOrder: 3, hidden: false, isCore: true, kind: "order" },
  { key: "contract",     label: "Umowa",               color: "#16a34a", sortOrder: 4, hidden: false, isCore: true, kind: "order" },
  { key: "kitting",      label: "Kompletacja",         color: "#0284c7", sortOrder: 5, hidden: false, isCore: true, kind: "order" },
  { key: "production",   label: "Produkcja",           color: "#7c3aed", sortOrder: 6, hidden: false, isCore: true, kind: "order" },
  { key: "installation", label: "Montaż",              color: "#14b8a6", sortOrder: 7, hidden: false, isCore: true, kind: "order" },
  { key: "complaint",    label: "Reklamacja",          color: "#dc2626", sortOrder: 8, hidden: false, isCore: true, kind: "order" },
  { key: "completed",    label: "Zakończone",          color: "#059669", sortOrder: 9, hidden: false, isCore: true, kind: "order" },
  { key: "archived",     label: "Archiwum",            color: "#6b7280", sortOrder: 10, hidden: true,  isCore: true, kind: "order" },
];

export const CORE_STATUSES: ReadonlyArray<StatusDef> = DEFAULT_STATUSES;
export const CORE_STATUS_KEYS: ReadonlyArray<string> = DEFAULT_STATUSES.map((s) => s.key);
/** Mapa klucz→kind dla statusów bazowych (do re-stemplowania i walidacji). */
const CORE_KIND_BY_KEY: Record<string, StatusKind> = Object.fromEntries(
  DEFAULT_STATUSES.map((s) => [s.key, s.kind]),
);

/** Stałe statusy szansy sprzedaży (strona "opportunity") — niezmienne. */
export const OPPORTUNITY_STATUS_KEYS: ReadonlyArray<string> = ["lead", "inquiry"];

// ── Helpery kolorów ────────────────────────────────────────────────
function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  const h = m ? m[1] : "6b7280"; // fallback: szary
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const h = (n: number) => clampByte(n).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Miesza kolor z bielą (amount→biały) lub czernią. amount 0..1. */
function mix(hex: string, target: { r: number; g: number; b: number }, amount: number): string {
  const c = parseHex(hex);
  return toHex({
    r: c.r + (target.r - c.r) * amount,
    g: c.g + (target.g - c.g) * amount,
    b: c.b + (target.b - c.b) * amount,
  });
}

const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };

/** Względna jasność 0..1 (do doboru czytelnego tekstu). */
function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export interface StatusStyle {
  /** Jasne tło pigułki/badge. */
  bg: string;
  /** Czytelny ciemny tekst pigułki/badge. */
  text: string;
  /** Obramowanie pigułki/badge. */
  border: string;
  /** Kropka / pasek akcentu (surowy kolor). */
  dot: string;
  /** Tło nagłówka kolumny Kanban (surowy kolor). */
  solidBg: string;
  /** Czytelny tekst na solidBg. */
  solidText: string;
  /** Obramowanie nagłówka kolumny Kanban. */
  solidBorder: string;
}

/**
 * Z jednego HEX wyprowadza komplet stylów — gwarantuje czytelność niezależnie
 * od wybranego koloru (tekst zawsze przyciemniony / kontrastowy).
 */
export function deriveStatusStyle(color: string): StatusStyle {
  const lum = luminance(color);
  return {
    bg: mix(color, WHITE, 0.86),
    // tekst: przyciemniamy mocniej, gdy kolor jest jasny
    text: mix(color, BLACK, lum > 0.6 ? 0.6 : 0.42),
    border: mix(color, WHITE, 0.55),
    dot: color,
    solidBg: color,
    solidText: lum > 0.6 ? "#1f2937" : "#ffffff",
    solidBorder: mix(color, BLACK, 0.28),
  };
}

// ── Łączenie kodowych domyślnych z konfiguracją z bazy ─────────────
/**
 * JEDYNA funkcja fallback/merge używana przez backend i frontend.
 * - `persisted` (crmConfig.statuses) niepuste → źródło prawdy (posortowane,
 *   z re-stemplowanym isCore/kind dla kluczy bazowych).
 * - puste → seed z DEFAULT_STATUSES + nałożenie starych nazw z `legacyLabels`
 *   (migracja crmConfig.statusLabels, w tym ewentualnej zmiany installation→"Realizacja").
 */
export function resolveStatuses(
  persisted?: StatusDef[] | null,
  legacyLabels?: Record<string, string> | null,
): StatusDef[] {
  let list: StatusDef[];

  if (persisted && persisted.length > 0) {
    const listMap = new Map(persisted.map((s) => [s.key, s]));
    for (const coreDef of DEFAULT_STATUSES) {
      if (!listMap.has(coreDef.key)) {
        listMap.set(coreDef.key, { ...coreDef });
      }
    }
    list = Array.from(listMap.values()).map((s) => {
      const coreKind = CORE_KIND_BY_KEY[s.key];
      const isCore = coreKind !== undefined;
      return {
        ...s,
        isCore,
        // dla kluczy bazowych wymuszamy kind z kodu (nie da się go zmienić)
        kind: isCore ? coreKind : (s.kind === "opportunity" ? "order" : s.kind),
      } as StatusDef;
    });
  } else {
    list = DEFAULT_STATUSES.map((s) => {
      const overriddenLabel = legacyLabels?.[s.key];
      return {
        ...s,
        label: overriddenLabel && overriddenLabel.trim() ? overriddenLabel : s.label,
      };
    });
  }

  return list.sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Slug klucza dla nowego własnego statusu (a-z0-9_), z prefiksem custom_. */
export function makeCustomStatusKey(label: string, existingKeys: ReadonlyArray<string>, seed: number): string {
  const base = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // usuń diakrytyki
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  const reserved = new Set([...existingKeys, ...CORE_STATUS_KEYS]);
  let key = `custom_${base || "status"}`;
  if (!reserved.has(key)) return key;
  // kolizja → dołóż seed
  key = `custom_${base || "status"}_${seed.toString(36)}`;
  let i = 1;
  while (reserved.has(key)) {
    key = `custom_${base || "status"}_${seed.toString(36)}_${i++}`;
  }
  return key;
}
