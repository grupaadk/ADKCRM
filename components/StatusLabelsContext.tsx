"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DEFAULT_STATUSES, type StatusDef } from "@/lib/statuses";

/** @deprecated — używaj rejestru (useStatuses/useStatusDef). Zachowane dla zgodności. */
export const DEFAULT_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  DEFAULT_STATUSES.map((s) => [s.key, s.label]),
);

interface RegistryValue {
  statuses: StatusDef[];
  byKey: Record<string, StatusDef>;
  labels: Record<string, string>;
}

function buildValue(statuses: StatusDef[]): RegistryValue {
  const byKey: Record<string, StatusDef> = {};
  const labels: Record<string, string> = {};
  for (const s of statuses) {
    byKey[s.key] = s;
    labels[s.key] = s.label;
  }
  return { statuses, byKey, labels };
}

const StatusRegistryContext = createContext<RegistryValue>(buildValue(DEFAULT_STATUSES));

export function StatusLabelsProvider({ children }: { children: ReactNode }) {
  const data = useQuery(api.crmConfig.listStatuses);
  const value = useMemo(
    () => buildValue((data as StatusDef[] | undefined) ?? DEFAULT_STATUSES),
    [data],
  );
  return (
    <StatusRegistryContext.Provider value={value}>
      {children}
    </StatusRegistryContext.Provider>
  );
}

/** Pełny rejestr statusów (posortowany wg sortOrder). */
export function useStatuses(): StatusDef[] {
  return useContext(StatusRegistryContext).statuses;
}

/** Definicja pojedynczego statusu (lub undefined dla nieznanego/osieroconego klucza). */
export function useStatusDef(key: string): StatusDef | undefined {
  return useContext(StatusRegistryContext).byKey[key];
}

/** Mapa klucz→nazwa (zgodność wsteczna). */
export function useStatusLabels(): Record<string, string> {
  return useContext(StatusRegistryContext).labels;
}

/** Nazwa pojedynczego statusu (fallback: surowy klucz). */
export function useStatusLabel(status: string): string {
  return useContext(StatusRegistryContext).labels[status] ?? status;
}
