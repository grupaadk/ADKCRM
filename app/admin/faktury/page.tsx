"use client";

import FakturaList from "./FakturaList";
import PinGate from "@/components/PinGate";

export default function FakturyPage() {
  return (
    <PinGate>
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Faktury</h1>
          <p className="mt-1 text-sm text-gray-500">
            Faktury pobrane z Fakturowni. Możesz przypisać je do zleceń w systemie.
          </p>
        </div>
        <FakturaList />
      </div>
    </PinGate>
  );
}
