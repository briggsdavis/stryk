import { v } from "convex/values"
import type { Doc } from "./_generated/dataModel"
import type { QueryCtx } from "./_generated/server"
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

// Ceiling on how many rows a single overview pull scans per event type. Well
// above this store's expected volume; if a window ever exceeds it the numbers
// become a (still-useful) sample rather than an exact count.
const SCAN_CAP = 20000

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
    await ctx.db.insert("analyticsEvents", {
      visitorId: args.visitorId.slice(0, 64),
      type: args.type,
      path: clip(args.path, 256),
      label: clip(args.label, 256),
      source: clip(args.source, 128),
      // Server clock — authoritative, immune to client skew.
      ts: Date.now(),
    })
    return null
  },
})

async function fetchType(ctx: QueryCtx, type: EventType, since: number, until: number) {
  return await ctx.db
    .query("analyticsEvents")
    .withIndex("by_type_and_ts", (q) => q.eq("type", type).gte("ts", since).lte("ts", until))
    .take(SCAN_CAP)
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

    const [pageViews, productViews, addToCarts, checkoutClicks, ctaClicks] = await Promise.all([
      fetchType(ctx, "page_view", since, until),
      fetchType(ctx, "product_view", since, until),
      fetchType(ctx, "add_to_cart", since, until),
      fetchType(ctx, "checkout_click", since, until),
      fetchType(ctx, "cta_click", since, until),
    ])

    // Prior-period totals — only the headline counts, so a single page_view
    // scan of the previous window is enough to know whether prior data exists.
    const prevPageViews = await fetchType(ctx, "page_view", args.prevStart, args.prevEnd)
    const prevCheckouts = await fetchType(ctx, "checkout_click", args.prevStart, args.prevEnd)

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
