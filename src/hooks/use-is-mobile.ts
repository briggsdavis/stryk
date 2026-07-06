import { useEffect, useState } from "react"

// The site's mobile breakpoint mirrors Tailwind's `md` (48rem = 768px). A single
// source of truth so JS-driven layout (focus panel width, control stacking, gesture
// hints) stays in sync with the CSS breakpoints.
export const MOBILE_QUERY = "(max-width: 767px)"

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia(MOBILE_QUERY).matches
  })

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY)
    const onChange = () => setIsMobile(mql.matches)
    onChange()
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
