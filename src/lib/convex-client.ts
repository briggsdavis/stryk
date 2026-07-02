import { ConvexReactClient } from "convex/react"

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined

// Shared Convex client. Only construct it when a URL is configured —
// `ConvexReactClient(undefined)` throws synchronously and would blank the app
// (e.g. a deploy missing VITE_CONVEX_URL). Exported so both the React provider
// tree (main.tsx) and fire-and-forget callers (analytics) use one instance.
export const convex = convexUrl ? new ConvexReactClient(convexUrl) : null
