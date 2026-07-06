import { useEffect, useState } from "react"

// The site's mobile breakpoint mirrors Tailwind's `md` (48rem = 768px). A single
// source of truth so JS-driven layout (focus panel width, control stacking, gesture
// hints) stays in sync with the CSS breakpoints.
export const MOBILE_QUERY = "(max-width: 767px)"

// Generic reactive matchMedia hook. `query` should be a stable string literal.
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [query])

  return matches
}

export function useIsMobile() {
  return useMediaQuery(MOBILE_QUERY)
}
