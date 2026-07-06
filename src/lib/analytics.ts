// Cookieless storefront analytics. A random visitor id lives in localStorage
// (no PII); the visit's traffic source is classified once from the referrer and
// cached for the session. Every tracked interaction is fire-and-forget so a
// failed/blocked request never affects the visitor's experience.

import { api } from "../../convex/_generated/api"
import { convex } from "./convex-client"

const VISITOR_KEY = "stryk-visitor-id"
const SOURCE_KEY = "stryk-analytics-source"

let fallbackVisitorId: string | null = null

export type AnalyticsEventType =
  | "page_view"
  | "product_view"
  | "add_to_cart"
  | "checkout_click"
  | "cta_click"

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  } catch {
    // fall through to Math.random fallback
  }
  return `v_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

function getVisitorId(): string {
  try {
    let id = window.localStorage.getItem(VISITOR_KEY)
    if (!id) {
      id = randomId()
      window.localStorage.setItem(VISITOR_KEY, id)
    }
    return id
  } catch {
    // Private mode / storage disabled: fall back to a stable per-load id.
    fallbackVisitorId ??= randomId()
    return fallbackVisitorId
  }
}

// Map the document referrer to a coarse, human-readable source bucket.
function classifyReferrer(): string {
  try {
    const ref = document.referrer
    if (!ref) return "Direct"
    const host = new URL(ref).hostname.replace(/^www\./, "")
    if (host === window.location.hostname) return "Direct"
    if (/google\./.test(host)) return "Google"
    if (/bing\./.test(host)) return "Bing"
    if (/duckduckgo\./.test(host)) return "DuckDuckGo"
    if (
      /(facebook|fb\.|instagram|t\.co|twitter|x\.com|linkedin|pinterest|tiktok|reddit)/.test(host)
    )
      return "Social"
    return host
  } catch {
    return "Direct"
  }
}

// One source per browser session, so every event in a visit agrees on where the
// visitor came from (a mid-session internal referrer would otherwise read as a
// new "Direct" source).
function getSource(): string {
  try {
    let source = window.sessionStorage.getItem(SOURCE_KEY)
    if (!source) {
      source = classifyReferrer()
      window.sessionStorage.setItem(SOURCE_KEY, source)
    }
    return source
  } catch {
    return classifyReferrer()
  }
}

// Friendly page name for a route path (used as the page_view label).
export function pageLabelFromPath(pathname: string): string {
  if (pathname === "/") return "Home"
  if (pathname === "/about") return "About"
  if (pathname === "/contact") return "Contact"
  if (pathname === "/collections") return "Collections"
  if (pathname.startsWith("/collection/")) {
    const slug = pathname.slice("/collection/".length).replace(/\/$/, "")
    return slug ? `Collection: ${slug}` : "Collection"
  }
  return pathname
}

export function track(
  type: AnalyticsEventType,
  opts?: { path?: string; label?: string; source?: string },
): void {
  if (!convex) return
  try {
    void convex
      .mutation(api.analytics.recordEvent, {
        visitorId: getVisitorId(),
        type,
        path: opts?.path,
        label: opts?.label,
        source: opts?.source ?? getSource(),
      })
      .catch(() => {
        // Swallow — analytics must never surface an error to the visitor.
      })
  } catch {
    // Never let tracking throw into the render/interaction path.
  }
}
