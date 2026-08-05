"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import ComplaintsTable from "@/components/complaints/ComplaintsTable";

type ComplaintTabProps = {
  orderId: Id<"orders">;
  clientId: Id<"clients">;
  /** Kept for API compatibility, not used in this component */
  complaintStartDate: number | null;
};

export default function ComplaintTab({ orderId, clientId }: ComplaintTabProps) {
  const complaints = useQuery(api.complaints.getAllByOrder, { orderId });

  return (
    <div style={{ padding: "20px 0" }}>
      <ComplaintsTable
        complaints={complaints}
        defaultClientId={clientId}
        defaultOrderId={orderId}
        compact={true}
        title="Reklamacje zlecenia"
      />
    </div>
  );
}
