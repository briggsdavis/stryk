import { clsx } from "clsx"
import type { ReactNode } from "react"

// Slide-swap label: the text rides up out of view while an identical copy rises
// in from below. Relies on a `group` ancestor (e.g. the capsule button) so it
// animates on the button's hover. Pair with an icon that nudges on hover.
export function HoverLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={clsx("relative inline-grid overflow-hidden", className)}>
      <span className="col-start-1 row-start-1 block transition-transform duration-[650ms] [transition-timing-function:var(--ease-ui)] group-hover:-translate-y-[120%]">
        {children}
      </span>
      <span
        aria-hidden="true"
        className="col-start-1 row-start-1 block translate-y-[120%] transition-transform duration-[650ms] [transition-timing-function:var(--ease-ui)] group-hover:translate-y-0"
      >
        {children}
      </span>
    </span>
  )
}
