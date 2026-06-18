import { clsx } from "clsx"
import type { ReactNode } from "react"

// Slide-swap label: the text rides up out of view while an identical copy rises
// in from below. Relies on a `group` ancestor (e.g. the capsule button) so it
// animates on the button's hover. Pair with an icon that nudges on hover.
//
// `px-1 -mx-1` pushes the overflow clip box out sideways (cancelled by the
// negative margin so layout width is unchanged), so the vertical clip used for
// the flip doesn't shave the last glyph's edge.
export function HoverLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={clsx("relative inline-grid -mx-1 overflow-hidden px-1", className)}>
      <span className="col-start-1 row-start-1 block transition-transform duration-[850ms] [transition-timing-function:var(--ease-ui)] group-hover:-translate-y-[120%]">
        {children}
      </span>
      <span
        aria-hidden="true"
        className="col-start-1 row-start-1 block translate-y-[120%] transition-transform duration-[850ms] [transition-timing-function:var(--ease-ui)] group-hover:translate-y-0"
      >
        {children}
      </span>
    </span>
  )
}
