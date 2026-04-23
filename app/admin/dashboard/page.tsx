"use client";

import { useRouter } from "next/navigation";
import PinGate from "@/components/PinGate";

export default function DashboardPage() {
  const router = useRouter();
  return (
    <PinGate onBack={() => router.back()}>
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        </div>
      </div>
    </PinGate>
  );
}
