import React from "react"
import { cx } from "./utils"

const Divider = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cx("flex items-center gap-3 py-1", className)} {...props}>
      <div className="h-px w-full bg-gray-200" />
    </div>
  ),
)
Divider.displayName = "Divider"

export { Divider }
