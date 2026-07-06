import { v } from "convex/values"
import type { Doc } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { requireAdmin } from "./admin"

const eventType = v.union(
  v.literal("page_view"),
  v.literal("product_view"),
  v.literal("add_to_cart"),
  v.literal("checkout_click"),
  v.literal("cta_click"),
)

type EventType = Doc<"analyticsEvents">["type"]

// Convex caps how many documents a single query may read (~16k). The overview
// reads the current window in one pass and the prior window in another, so both
// caps together must stay comfortably under that ceiling. If a window holds more
// rows than its cap, the query returns a (still-useful) sample and flags
// `truncated` so the UI can say so, rather than throwing.
const MAIN_SCAN_CAP = 10000
const PREV_SCAN_CAP = 3000
// Best-effort abuse guard. `visitorId` is client-supplied, so this limits noisy
// clients and accidents; it is not a hard security boundary.
const VISITOR_RATE_WINDOW_MS = 60_000
const VISITOR_RATE_CAP = 120

async function isOverVisitorRateLimit(ctx: MutationCtx, visitorId: string, now: number) {
  const recent = await ctx.db
    .query("analyticsEvents")
    .withIndex("by_visitorId_and_ts", (q) =>
      q.eq("visitorId", visitorId).gte("ts", now - VISITOR_RATE_WINDOW_MS),
    )
    .take(VISITOR_RATE_CAP)
  return recent.length >= VISITOR_RATE_CAP
}

// Public, unauthenticated: the storefront records its own events. Deliberately
// tolerant — a bad/oversized field must never break the visitor's page.
export const recordEvent = mutation({
  args: {
    visitorId: v.string(),
    type: eventType,
    path: v.optional(v.string()),
    label: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const clip = (value: string | undefined, max: number) =>
      value === undefined ? undefined : value.slice(0, max)
    const visitorId = args.visitorId.trim().slice(0, 64)
    if (!visitorId) return null

    const now = Date.now()
    if (await isOverVisitorRateLimit(ctx, visitorId, now)) return null

    await ctx.db.insert("analyticsEvents", {
      visitorId,
      type: args.type,
      path: clip(args.path, 256),
      label: clip(args.label, 256),
      source: clip(args.source, 128),
      // Server clock — authoritative, immune to client skew.
      ts: now,
    })
    return null
  },
})

// Read every event in [since, until] in one newest-first scan, bounded by `cap`.
// One scan across all types (rather than one per type) keeps total
// document reads predictable and well under Convex's per-query limit.
async function scanWindow(ctx: QueryCtx, since: number, until: number, cap: number) {
  return await ctx.db
    .query("analyticsEvents")
    .withIndex("by_ts", (q) => q.gte("ts", since).lte("ts", until))
    .order("desc")
    .take(cap)
}

function ofType(rows: Doc<"analyticsEvents">[], type: EventType) {
  return rows.filter((row) => row.type === type)
}

// Tally a string dimension into a sorted, capped list of {label, count}.
function tally(rows: Doc<"analyticsEvents">[], pick: (row: Doc<"analyticsEvents">) => string) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = pick(row)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}

function distinctVisitors(rows: Doc<"analyticsEvents">[]) {
  return new Set(rows.map((row) => row.visitorId)).size
}

// One admin-facing pull that powers the whole analytics dashboard. The client
// owns all calendar math (timezones, DST): it passes the resolved window plus a
// list of pre-computed buckets, and this query just tallies rows into them.
export const getOverview = query({
  args: {
    buckets: v.array(v.object({ start: v.number(), end: v.number(), label: v.string() })),
    // Immediately-preceding window of equal length, for prior-period deltas.
    prevStart: v.number(),
    prevEnd: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const buckets = args.buckets
    if (buckets.length === 0) {
      throw new Error("At least one bucket is required.")
    }
    const since = buckets[0].start
    const until = buckets[buckets.length - 1].end

    // Two bounded scans: the current window and the prior window.
    const [current, previous] = await Promise.all([
      scanWindow(ctx, since, until, MAIN_SCAN_CAP),
      scanWindow(ctx, args.prevStart, args.prevEnd, PREV_SCAN_CAP),
    ])
    const truncated = current.length >= MAIN_SCAN_CAP

    const pageViews = ofType(current, "page_view")
    const productViews = ofType(current, "product_view")
    const addToCarts = ofType(current, "add_to_cart")
    const checkoutClicks = ofType(current, "checkout_click")
    const ctaClicks = ofType(current, "cta_click")

    const prevPageViews = ofType(previous, "page_view")
    const prevCheckouts = ofType(previous, "checkout_click")

    // Traffic over time: page views + distinct visitors per bucket.
    const trafficBuckets = buckets.map((bucket) => {
      const inBucket = pageViews.filter((row) => row.ts >= bucket.start && row.ts < bucket.end)
      return {
        label: bucket.label,
        pageViews: inBucket.length,
        visitors: distinctVisitors(inBucket),
      }
    })

    const visitors = distinctVisitors(pageViews)
    const checkoutVisitors = distinctVisitors(checkoutClicks)
    const conversionRate = visitors > 0 ? checkoutVisitors / visitors : 0

    const labelOf = (row: Doc<"analyticsEvents">) => row.label || row.path || "Unknown"
    const sourceOf = (row: Doc<"analyticsEvents">) => row.source || "Direct"

    return {
      // True when the window held more rows than the scan cap, so the numbers
      // below are a sample of the most recent activity, not an exact count.
      truncated,
      totals: {
        pageViews: pageViews.length,
        visitors,
        productViews: productViews.length,
        addToCarts: addToCarts.length,
        checkoutClicks: checkoutClicks.length,
        conversionRate,
      },
      // `hasPrior` gates the "no prior data" copy from the screenshot.
      prior: {
        hasPrior: prevPageViews.length > 0 || prevCheckouts.length > 0,
        pageViews: prevPageViews.length,
        visitors: distinctVisitors(prevPageViews),
        checkoutClicks: prevCheckouts.length,
      },
      trafficBuckets,
      topPages: tally(pageViews, labelOf).slice(0, 8),
      sources: tally(pageViews, sourceOf),
      funnel: {
        visited: visitors,
        viewedProduct: distinctVisitors(productViews),
        addedToCart: distinctVisitors(addToCarts),
        checkout: checkoutVisitors,
      },
      checkoutBySource: tally(checkoutClicks, sourceOf),
      topAddedProducts: tally(addToCarts, labelOf).slice(0, 8),
      ctaClicks: tally(ctaClicks, labelOf).slice(0, 8),
    }
  },
})
