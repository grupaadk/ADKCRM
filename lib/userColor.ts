const U_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#06b6d4", "#84cc16"];

/** Deterministyczny kolor na podstawie id usera. */
export function uColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return U_COLORS[h % U_COLORS.length];
}

/** Inicjały z nazwy (imię + nazwisko → 2 litery). */
export function uInitials(name: string): string {
  const p = name.trim().split(/\s+/);
  if (p.length >= 2 && p[0] && p[p.length - 1]) {
    return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
