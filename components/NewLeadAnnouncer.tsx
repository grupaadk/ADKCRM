"use client"

import { useEffect, useState } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import DollarRain from "./DollarRain"

const STORAGE_KEY = "adk_last_seen_lead_creation"

function readStored(): number | null {
  if (typeof window === "undefined") return null
  const v = window.localStorage.getItem(STORAGE_KEY)
  if (v === null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export default function NewLeadAnnouncer() {
  const latest = useQuery(api.salesOpportunities.latestLeadOpportunity)
  const latestCreatedAt = latest?.createdAt ?? null

  const [lastSeen, setLastSeen] = useState<number | null>(readStored)
  const [trigger, setTrigger] = useState<number | null>(null)
  const [prev, setPrev] = useState<number | null | undefined>(undefined)

  if (latest !== undefined && latestCreatedAt !== prev) {
    setPrev(latestCreatedAt)
    if (latestCreatedAt !== null) {
      if (lastSeen === null) {
        setLastSeen(latestCreatedAt)
      } else if (latestCreatedAt > lastSeen) {
        setLastSeen(latestCreatedAt)
        setTrigger(latestCreatedAt)
      }
    }
  }

  useEffect(() => {
    if (lastSeen === null) return
    if (typeof window === "undefined") return
    window.localStorage.setItem(STORAGE_KEY, String(lastSeen))
  }, [lastSeen])

  return <DollarRain trigger={trigger} />
}
