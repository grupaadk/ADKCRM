"use client"

import OrderList from "./OrderList"
import { CrmPageHeader } from "@/components/crm-ui"
import { Plus, SlidersHorizontal } from "lucide-react"

export default function ZamowieniaPage() {
  return (
    <div>
      <CrmPageHeader
        title="Zlecenia"
        sub="Lista wszystkich zleceń w systemie."
        actions={
          <>
            <button className="btn">
              <SlidersHorizontal size={13} /> Filtry
            </button>
            <button className="btn primary">
              <Plus size={13} /> Nowe zlecenie
            </button>
          </>
        }
      />
      <OrderList />
    </div>
  )
}
