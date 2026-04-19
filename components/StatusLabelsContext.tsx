"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export const DEFAULT_STATUS_LABELS: Record<string, string> = {
  lead: "Oferta",
  inquiry: "Oferta wysłana",
  measurement: "Do pomiarów",
  offer: "Oferta po pomiarze",
  contract: "Akceptacja",
  production: "Zamówienie",
  installation: "Realizowane",
  completed: "Reklamacja",
  warranty: "Zakończone",
};

const StatusLabelsContext = createContext<Record<string, string>>(DEFAULT_STATUS_LABELS);

export function StatusLabelsProvider({ children }: { children: ReactNode }) {
  const config = useQuery(api.crmConfig.getConfig);

  const labels: Record<string, string> = { ...DEFAULT_STATUS_LABELS };
  if (config?.statusLabels) {
    for (const [key, value] of Object.entries(config.statusLabels)) {
      if (value) labels[key] = value;
    }
  }

  return (
    <StatusLabelsContext.Provider value={labels}>
      {children}
    </StatusLabelsContext.Provider>
  );
}

export function useStatusLabels(): Record<string, string> {
  return useContext(StatusLabelsContext);
}

export function useStatusLabel(status: string): string {
  const labels = useContext(StatusLabelsContext);
  return labels[status] ?? status;
}
