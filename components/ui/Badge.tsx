// Tremor Badge [v0.0.1]

import React from "react"
import { tv, type VariantProps } from "tailwind-variants"
import { cx } from "./utils"
import { useStatusLabels, DEFAULT_STATUS_LABELS } from "@/components/StatusLabelsContext"

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

// ADK Status mapping
const STATUS_BADGE_MAP: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  lead:         { label: "Lead",               variant: "default" },
  inquiry:      { label: "Oferta wysłana",     variant: "purple" },
  measurement:  { label: "Do pomiarów",        variant: "amber" },
  offer:        { label: "Oferta po pomiarze", variant: "orange" },
  contract:     { label: "Umowa",              variant: "success" },
  production:   { label: "Produkcja",          variant: "violet" },
  installation: { label: "Montaż",             variant: "teal" },
  completed:    { label: "Zakończone",         variant: "success" },
  warranty:     { label: "Gwarancja",          variant: "cyan" },
}

export function StatusBadge({ status }: { status: string }) {
  const labels = useStatusLabels()
  const config = STATUS_BADGE_MAP[status] ?? { label: status, variant: "neutral" as const }
  const label = labels[status] ?? config.label
  return (
    <Badge variant={config.variant}>
      <span
        className={cx(
          "size-1.5 shrink-0 rounded-full",
          status === "lead"         && "bg-blue-500",
          status === "inquiry"      && "bg-purple-500",
          status === "measurement"  && "bg-amber-500",
          status === "offer"        && "bg-orange-500",
          status === "contract"     && "bg-emerald-600",
          status === "production"   && "bg-violet-500",
          status === "installation" && "bg-teal-500",
          status === "completed"    && "bg-emerald-600",
          status === "warranty"     && "bg-cyan-500",
          !STATUS_BADGE_MAP[status] && "bg-gray-500",
        )}
        aria-hidden="true"
      />
      {label}
    </Badge>
  )
}

export function getStatusLabel(status: string): string {
  return DEFAULT_STATUS_LABELS[status] ?? STATUS_BADGE_MAP[status]?.label ?? status
}
