"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CrmPageHeader } from "@/components/crm-ui";
import { Receipt, CircleDollarSign, BarChart3 } from "lucide-react";
import FakturaList from "../faktury/FakturaList";
import ExpenseList from "../wydatki/ExpenseList";
import { OrdersFinancialSummary } from "@/components/OrdersFinancialSummary";

type Tab = "zestawienie" | "faktury" | "wydatki";

export default function FinansePage() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) ?? "zestawienie";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  return (
    <div className="space-y-6">
      <CrmPageHeader
        title="Finanse"
        sub="Zestawienie finansowe wszystkich zleceń, przychodów oraz kosztów i wydatków."
      />

      {/* Tabs Switcher */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          <button
            type="button"
            onClick={() => setActiveTab("zestawienie")}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition-colors ${
              activeTab === "zestawienie"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            <BarChart3 className="size-4" />
            Zestawienie zleceń
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("faktury")}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition-colors ${
              activeTab === "faktury"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            <Receipt className="size-4" />
            Faktury
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("wydatki")}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition-colors ${
              activeTab === "wydatki"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            <CircleDollarSign className="size-4" />
            Wydatki i Koszty
          </button>
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "zestawienie" && <OrdersFinancialSummary />}
        {activeTab === "faktury" && <FakturaList />}
        {activeTab === "wydatki" && <ExpenseList />}
      </div>
    </div>
  );
}
