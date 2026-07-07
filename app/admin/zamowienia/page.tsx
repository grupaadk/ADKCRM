"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import OrderList from "./OrderList"
import { CrmPageHeader } from "@/components/crm-ui"
import { Plus, SlidersHorizontal, Search, X } from "lucide-react"
import NewOrderModal from "@/app/admin/klient/[id]/NewOrderModal"

export default function ZamowieniaPage() {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  return (
    <div>
      <CrmPageHeader
        title="Zlecenia"
        sub="Lista wszystkich zleceń w systemie."
        center={
          <div style={{ position: "relative", width: "100%", maxWidth: 420 }}>
            <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--text-mute)" }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Wyszukaj zlecenie..."
              style={{
                width: "100%",
                padding: "8px 30px 8px 34px",
                borderRadius: 999,
                border: "1px solid var(--line)",
                background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "inherit",
                color: "var(--text-strong)",
                outline: "none",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-soft)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--accent-line)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "var(--panel-3)", border: "none", borderRadius: "50%",
                  cursor: "pointer", color: "var(--text-mute)", width: 20, height: 20,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <X style={{ width: 12, height: 12 }} />
              </button>
            )}
          </div>
        }
        actions={
          <>
            <button
              className={`btn ${showFilters ? 'active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
              style={{ background: showFilters ? 'var(--panel-3)' : undefined }}
            >
              <SlidersHorizontal size={13} /> Filtry
            </button>
            <button className="btn primary" onClick={() => setShowModal(true)}>
              <Plus size={13} /> Nowe zlecenie
            </button>
          </>
        }
      />
      <OrderList searchTerm={searchTerm} showFilters={showFilters} />
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
