"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import OrderList from "./OrderList"
import { CrmPageHeader } from "@/components/crm-ui"
import { Plus, SlidersHorizontal } from "lucide-react"
import NewOrderModal from "@/app/admin/klient/[id]/NewOrderModal"

export default function ZamowieniaPage() {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)

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
            <button className="btn primary" onClick={() => setShowModal(true)}>
              <Plus size={13} /> Nowe zlecenie
            </button>
          </>
        }
      />
      <OrderList />
      {showModal && (
        <NewOrderModal
          onClose={() => setShowModal(false)}
          onSuccess={(orderId, clientId) => {
            setShowModal(false)
            router.push(`/admin/klient/${clientId}/zlecenie/${orderId}`)
          }}
        />
      )}
    </div>
  )
}
