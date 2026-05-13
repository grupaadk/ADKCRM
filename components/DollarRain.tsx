"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

const EMOJIS = ["💵", "💰", "💸", "💴", "💶"]
const COUNT = 180
const DURATION_MS = 11000
const MAX_STAGGER_MS = 8000

type Drop = {
  emoji: string
  left: number
  delay: number
  duration: number
  rotateFrom: number
  rotateTo: number
  size: number
  drift: number
}

function makeDrops(): Drop[] {
  return Array.from({ length: COUNT }, () => ({
    emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
    left: Math.random() * 100,
    delay: Math.random() * MAX_STAGGER_MS,
    duration: 1800 + Math.random() * 1400,
    rotateFrom: Math.random() * 360 - 180,
    rotateTo: Math.random() * 720 - 360,
    size: 26 + Math.random() * 22,
    drift: (Math.random() - 0.5) * 80,
  }))
}

export default function DollarRain({ trigger }: { trigger: number | null }) {
  const [burstKey, setBurstKey] = useState<number | null>(null)
  const [prevTrigger, setPrevTrigger] = useState<number | null>(null)

  if (trigger !== prevTrigger) {
    setPrevTrigger(trigger)
    if (trigger !== null) setBurstKey(trigger)
  }

  const handleDone = useCallback(() => setBurstKey(null), [])

  if (burstKey === null) return null
  return <Burst key={burstKey} onDone={handleDone} />
}

function Burst({ onDone }: { onDone: () => void }) {
  const drops = useMemo(() => makeDrops(), [])
  const [armed, setArmed] = useState<boolean>(() => {
    if (typeof document === "undefined") return true
    return document.visibilityState === "visible"
  })

  useEffect(() => {
    if (armed) return
    if (typeof document === "undefined") return
    const onVis = () => {
      if (document.visibilityState === "visible") setArmed(true)
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [armed])

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(onDone, DURATION_MS)
    return () => clearTimeout(t)
  }, [armed, onDone])

  if (!armed) return null

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 9999,
      }}
    >
      <style>{`
        @keyframes adk-dollar-fall {
          0%   { transform: translate3d(0, -15vh, 0) rotate(var(--r0)); opacity: 0; }
          6%   { opacity: 1; }
          94%  { opacity: 1; }
          100% { transform: translate3d(var(--dx), 115vh, 0) rotate(var(--r1)); opacity: 0; }
        }
      `}</style>
      {drops.map((d, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: 0,
            left: `${d.left}%`,
            fontSize: `${d.size}px`,
            lineHeight: 1,
            willChange: "transform, opacity",
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,.25))",
            animation: `adk-dollar-fall ${d.duration}ms cubic-bezier(.4,.05,.6,1) ${d.delay}ms forwards`,
            ["--r0" as string]: `${d.rotateFrom}deg`,
            ["--r1" as string]: `${d.rotateTo}deg`,
            ["--dx" as string]: `${d.drift}px`,
          } as React.CSSProperties}
        >
          {d.emoji}
        </span>
      ))}
    </div>
  )
}
