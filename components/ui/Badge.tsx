// Tremor Badge [v0.0.1]

import React from "react"
import { tv, type VariantProps } from "tailwind-variants"
import { cx } from "./utils"
import { useStatusDef } from "@/components/StatusLabelsContext"
import { deriveStatusStyle } from "@/lib/statuses"

const badgeVariants = tv({
  base: cx(
    "inline-flex items-center gap-x-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
  ),
  variants: {
    variant: {
      default: "bg-blue-50 text-blue-900 ring-blue-500/30",
      neutral: "bg-gray-50 text-gray-900 ring-gray-500/30",
      success: "bg-emerald-50 text-emerald-900 ring-emerald-600/30",
      error: "bg-red-50 text-red-900 ring-red-600/20",
      warning: "bg-yellow-50 text-yellow-900 ring-yellow-600/30",
      purple: "bg-purple-50 text-purple-900 ring-purple-500/30",
      amber: "bg-amber-50 text-amber-900 ring-amber-500/30",
      orange: "bg-orange-50 text-orange-900 ring-orange-500/30",
      violet: "bg-violet-50 text-violet-900 ring-violet-500/30",
      teal: "bg-teal-50 text-teal-900 ring-teal-500/30",
      cyan: "bg-cyan-50 text-cyan-900 ring-cyan-500/30",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

interface BadgeProps
  extends React.ComponentPropsWithoutRef<"span">,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, forwardedRef) => (
    <span
      ref={forwardedRef}
      className={cx(badgeVariants({ variant }), className)}
      {...props}
    />
  ),
)
Badge.displayName = "Badge"

export { Badge, badgeVariants, type BadgeProps }

// ADK Status badge — nazwa i kolor z dynamicznego rejestru
export function StatusBadge({ status }: { status: string }) {
  const def = useStatusDef(status)
  const label = def?.label ?? status
  const style = deriveStatusStyle(def?.color ?? "#6b7280")
  return (
    <span
      className={cx(
        "inline-flex items-center gap-x-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
      )}
      style={{ background: style.bg, color: style.text, boxShadow: `inset 0 0 0 1px ${style.border}` }}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: style.dot }}
        aria-hidden="true"
      />
      {label}
    </span>
  )
}
