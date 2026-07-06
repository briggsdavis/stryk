import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { requireAdmin } from "./admin"

const eventType = v.union(
  v.literal("page_view"),
  v.literal("product_view"),
  v.literal("add_to_cart"),
  v.literal("checkout_click"),
  v.literal("cta_click"),
  v.literal("popup_view"),
  v.literal("popup_click"),
  v.literal("announcement_view"),
  v.literal("announcement_click"),
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

// ── Marketing & product analytics ────────────────────────────────────────────

// One bounded, newest-first scan of a single event type within [since, until].
// Using the (type, ts) index keeps reads predictable even when other event
// types (page views) dominate the table.
async function scanTypeWindow(
  ctx: QueryCtx,
  type: EventType,
  since: number,
  until: number,
  cap: number,
) {
  return await ctx.db
    .query("analyticsEvents")
    .withIndex("by_type_and_ts", (q) => q.eq("type", type).gte("ts", since).lte("ts", until))
    .order("desc")
    .take(cap)
}

// Count rows of `type` whose `path` equals a specific id, over all time. Bounded
// by `cap`; the boolean says whether the true count exceeds what we read.
async function countByPath(ctx: QueryCtx, type: EventType, path: string, cap: number) {
  const rows = await ctx.db
    .query("analyticsEvents")
    .withIndex("by_type_and_path", (q) => q.eq("type", type).eq("path", path))
    .take(cap)
  return { count: rows.length, truncated: rows.length >= cap }
}

// Tally a set of events into a Map keyed by their `path` (the marketing item id).
function tallyByPath(rows: Doc<"analyticsEvents">[]) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (!row.path) continue
    counts.set(row.path, (counts.get(row.path) ?? 0) + 1)
  }
  return counts
}

const MARKETING_SCAN_CAP = 5000

// Powers the "Marketing" tab: per-pop-up and per-announcement impressions,
// clicks, click-through rate, and (for pop-ups) email sign-ups over a window.
export const getMarketingOverview = query({
  args: { since: v.number(), until: v.number() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const { since, until } = args

    const [popupViews, popupClicks, annViews, annClicks, popupList, annList, captures] =
      await Promise.all([
        scanTypeWindow(ctx, "popup_view", since, until, MARKETING_SCAN_CAP),
        scanTypeWindow(ctx, "popup_click", since, until, MARKETING_SCAN_CAP),
        scanTypeWindow(ctx, "announcement_view", since, until, MARKETING_SCAN_CAP),
        scanTypeWindow(ctx, "announcement_click", since, until, MARKETING_SCAN_CAP),
        ctx.db.query("popups").withIndex("by_updatedAt").order("desc").take(50),
        ctx.db.query("announcementBars").withIndex("by_updatedAt").order("desc").take(50),
        ctx.db.query("popupEmailCaptures").order("desc").take(2000),
      ])

    const pv = tallyByPath(popupViews)
    const pc = tallyByPath(popupClicks)
    const av = tallyByPath(annViews)
    const ac = tallyByPath(annClicks)

    // Email sign-ups per pop-up, counted within the window.
    const signups = new Map<string, number>()
    for (const capture of captures) {
      if (!capture.popupId) continue
      if (capture._creationTime < since || capture._creationTime > until) continue
      signups.set(capture.popupId, (signups.get(capture.popupId) ?? 0) + 1)
    }

    const rate = (clicks: number, views: number) => (views > 0 ? clicks / views : 0)

    const popups = popupList
      .map((popup) => {
        const views = pv.get(popup._id) ?? 0
        const clicks = pc.get(popup._id) ?? 0
        const emailSignups = signups.get(popup._id) ?? 0
        return {
          id: popup._id,
          title: popup.title || popup.heading || "Untitled pop-up",
          views,
          clicks,
          signups: emailSignups,
          ctr: rate(clicks, views),
        }
      })
      .sort((a, b) => b.views - a.views || b.clicks - a.clicks)

    const announcements = annList
      .map((announcement) => {
        const views = av.get(announcement._id) ?? 0
        const clicks = ac.get(announcement._id) ?? 0
        return {
          id: announcement._id,
          title: announcement.title || announcement.text || "Untitled bar",
          views,
          clicks,
          ctr: rate(clicks, views),
        }
      })
      .sort((a, b) => b.views - a.views || b.clicks - a.clicks)

    const truncated = [popupViews, popupClicks, annViews, annClicks].some(
      (rows) => rows.length >= MARKETING_SCAN_CAP,
    )

    return {
      truncated,
      totals: {
        popupViews: popupViews.length,
        popupClicks: popupClicks.length,
        announcementViews: annViews.length,
        announcementClicks: annClicks.length,
        signups: [...signups.values()].reduce((sum, n) => sum + n, 0),
      },
      popups,
      announcements,
    }
  },
})

// All-time stats for a single pop-up or announcement, for the row-level modal.
export const getMarketingItemStats = query({
  args: {
    kind: v.union(v.literal("popup"), v.literal("announcement")),
    id: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const CAP = 10000
    const viewType: EventType = args.kind === "popup" ? "popup_view" : "announcement_view"
    const clickType: EventType = args.kind === "popup" ? "popup_click" : "announcement_click"

    const [views, clicks] = await Promise.all([
      countByPath(ctx, viewType, args.id, CAP),
      countByPath(ctx, clickType, args.id, CAP),
    ])

    let signups: number | null = null
    if (args.kind === "popup") {
      const captures = await ctx.db
        .query("popupEmailCaptures")
        .withIndex("by_popupId", (q) => q.eq("popupId", args.id as Id<"popups">))
        .take(CAP)
      signups = captures.length
    }

    return {
      views: views.count,
      clicks: clicks.count,
      signups,
      ctr: views.count > 0 ? clicks.count / views.count : 0,
      truncated: views.truncated || clicks.truncated,
    }
  },
})

const PRODUCT_PV_CAP = 6000
const PRODUCT_VIEW_CAP = 4000
const PRODUCT_CART_CAP = 4000
const COLLECTION_LABEL_PREFIX = "Collection: "

// Powers the "Products" tab: most-viewed products & collections, plus an
// ESTIMATED revenue ranking. Shopify only exposes the catalog to this app (no
// order webhook), so revenue is estimated as add-to-cart events × the product's
// mid catalog price — directional, never actual sales.
export const getProductsOverview = query({
  args: { since: v.number(), until: v.number() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const { since, until } = args

    const [pageViews, productViews, addToCarts, products] = await Promise.all([
      scanTypeWindow(ctx, "page_view", since, until, PRODUCT_PV_CAP),
      scanTypeWindow(ctx, "product_view", since, until, PRODUCT_VIEW_CAP),
      scanTypeWindow(ctx, "add_to_cart", since, until, PRODUCT_CART_CAP),
      ctx.db
        .query("catalogProducts")
        .withIndex("by_isVisible_and_sortRank", (q) => q.eq("isVisible", true))
        .take(500),
    ])

    // Product title (lowercased) → mid catalog price, for revenue estimation.
    const priceByTitle = new Map<string, number>()
    for (const product of products) {
      const mid = (product.priceMin + product.priceMax) / 2
      priceByTitle.set(product.title.trim().toLowerCase(), mid)
    }
    const currencyCode = products[0]?.currencyCode ?? "USD"

    const labelOf = (row: Doc<"analyticsEvents">) => row.label || row.path || "Unknown"

    // Most-viewed products.
    const topProducts = tally(productViews, labelOf).slice(0, 10)

    // Most-viewed collections: page views whose label is "Collection: <name>".
    const collectionViews = pageViews.filter((row) =>
      (row.label ?? "").startsWith(COLLECTION_LABEL_PREFIX),
    )
    const topCollections = tally(collectionViews, (row) =>
      (row.label ?? "").slice(COLLECTION_LABEL_PREFIX.length),
    ).slice(0, 10)

    // Estimated revenue from add-to-cart events × mid price.
    const cartCounts = tally(addToCarts, labelOf)
    let totalEstRevenue = 0
    const revenue = cartCounts
      .map((item) => {
        const price = priceByTitle.get(item.label.trim().toLowerCase()) ?? 0
        const estRevenue = price * item.count
        totalEstRevenue += estRevenue
        return { label: item.label, units: item.count, estRevenue }
      })
      .sort((a, b) => b.estRevenue - a.estRevenue)
      .slice(0, 10)

    const truncated =
      pageViews.length >= PRODUCT_PV_CAP ||
      productViews.length >= PRODUCT_VIEW_CAP ||
      addToCarts.length >= PRODUCT_CART_CAP

    return {
      truncated,
      currencyCode,
      topProducts,
      topCollections,
      revenue,
      totalEstRevenue,
    }
  },
})

// Powers the "Dashboard" overview landing: unhandled inquiries, fresh email
// captures, and a few quick traffic numbers over the caller-supplied window.
export const getDashboardSummary = query({
  args: { since: v.number(), until: v.number() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const { since, until } = args

    const [newInquiries, captures, pageViews, popupViews] = await Promise.all([
      ctx.db
        .query("contactInquiries")
        .withIndex("by_status", (q) => q.eq("status", "new"))
        .order("desc")
        .take(100),
      ctx.db.query("popupEmailCaptures").order("desc").take(500),
      scanTypeWindow(ctx, "page_view", since, until, PRODUCT_PV_CAP),
      scanTypeWindow(ctx, "popup_view", since, until, MARKETING_SCAN_CAP),
    ])

    const recentCaptures = captures.slice(0, 5).map((capture) => ({
      email: capture.email,
      source: capture.source,
      ts: capture._creationTime,
    }))
    const capturesInWindow = captures.filter(
      (capture) => capture._creationTime >= since && capture._creationTime <= until,
    ).length

    return {
      inquiries: {
        newCount: newInquiries.length,
        capped: newInquiries.length >= 100,
        recent: newInquiries.slice(0, 5).map((inquiry) => ({
          id: inquiry._id,
          name: `${inquiry.firstName} ${inquiry.lastName}`.trim(),
          email: inquiry.email,
          inquiryType: inquiry.inquiryType,
          ts: inquiry._creationTime,
        })),
      },
      emailCaptures: {
        windowCount: capturesInWindow,
        recent: recentCaptures,
      },
      quickStats: {
        pageViews: pageViews.length,
        visitors: distinctVisitors(pageViews),
        popupViews: popupViews.length,
      },
    }
  },
})
