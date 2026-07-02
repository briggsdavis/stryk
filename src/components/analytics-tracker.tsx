import { useEffect } from "react"
import { useLocation } from "react-router"
import { pageLabelFromPath, track } from "../lib/analytics"

// Fires a `page_view` on every route change. Mounted once inside the router.
// The admin area is intentionally excluded — it isn't storefront traffic.
export function AnalyticsTracker() {
  const location = useLocation()

  useEffect(() => {
    if (location.pathname.startsWith("/admin")) return
    track("page_view", {
      path: location.pathname,
      label: pageLabelFromPath(location.pathname),
    })
  }, [location.pathname])

  return null
}
