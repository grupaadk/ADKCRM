"use client";

import { useSearchParams } from "next/navigation";
import NewOpportunityForm from "@/components/NewOpportunityForm";
import type { Id } from "@/convex/_generated/dataModel";

export default function NowaSzansaPage() {
  const searchParams = useSearchParams();
  const clientIdRaw = searchParams.get("clientId");
  const initialClientId = clientIdRaw ? (clientIdRaw as Id<"clients">) : undefined;

  return (
    <div className="w-full min-h-screen py-6 px-4 md:px-8 max-w-7xl mx-auto">
      <NewOpportunityForm initialClientId={initialClientId} />
    </div>
  );
}
