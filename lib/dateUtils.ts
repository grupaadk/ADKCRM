/**
 * Formats a timestamp into YYYY-MM-DD using local time (not UTC),
 * suitable for HTML <input type="date">.
 */
export function formatLocalDateInput(ts: number | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Parses a YYYY-MM-DD date string into a local midnight timestamp (00:00:00 local time).
 */
export function parseLocalDateInput(val: string): number {
  const [year, month, day] = val.split("-").map(Number);
  const d = new Date(year, month - 1, day, 0, 0, 0, 0);
  return d.getTime();
}
