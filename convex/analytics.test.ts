/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { expect, test } from "vitest"
import { buildRange } from "../src/lib/analytics-ranges"
import { api } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob("./**/*.ts")

async function makeAdmin(t: ReturnType<typeof convexTest>) {
  process.env.ADMIN_EMAILS = "admin@example.com"
  const userId = await t.run(async (ctx) => ctx.db.insert("users", { email: "admin@example.com" }))
  return t.withIdentity({ subject: `${userId}|s1` })
}

test("getOverview with zero events does not throw", async () => {
  const t = convexTest(schema, modules)
  const asAdmin = await makeAdmin(t)
  const r = buildRange("1w", Date.now())
  const result = await asAdmin.query(api.analytics.getOverview, {
    buckets: r.buckets,
    prevStart: r.prevStart,
    prevEnd: r.prevEnd,
  })
  expect(result.totals.pageViews).toBe(0)
  expect(result.trafficBuckets.length).toBe(7)
})

test("getOverview with real week buckets tallies", async () => {
  const t = convexTest(schema, modules)
  const asAdmin = await makeAdmin(t)
  const now = Date.now()
  await t.run(async (ctx) => {
    for (let i = 0; i < 4; i++) {
      await ctx.db.insert("analyticsEvents", {
        visitorId: `v${i}`,
        type: "page_view",
        path: "/",
        label: "Home",
        source: "Direct",
        ts: now - i * 3600_000,
      })
    }
  })
  const r = buildRange("1w", now)
  const result = await asAdmin.query(api.analytics.getOverview, {
    buckets: r.buckets,
    prevStart: r.prevStart,
    prevEnd: r.prevEnd,
  })
  expect(result.totals.pageViews).toBe(4)
})

test("getOverview partitions event types and builds the funnel", async () => {
  const t = convexTest(schema, modules)
  const asAdmin = await makeAdmin(t)
  const now = Date.now()
  await t.run(async (ctx) => {
    const rows = [
      { type: "page_view" as const, source: "Google" },
      { type: "page_view" as const, source: "Direct" },
      { type: "product_view" as const, label: "Ember" },
      { type: "add_to_cart" as const, label: "Ember" },
      { type: "checkout_click" as const, source: "Google" },
      { type: "cta_click" as const, label: "Pop-up · Sign up" },
    ]
    for (const row of rows) {
      await ctx.db.insert("analyticsEvents", { visitorId: "v0", ts: now - 1000, ...row })
    }
  })
  const r = buildRange("1w", now)
  const result = await asAdmin.query(api.analytics.getOverview, {
    buckets: r.buckets,
    prevStart: r.prevStart,
    prevEnd: r.prevEnd,
  })
  expect(result.truncated).toBe(false)
  expect(result.totals.pageViews).toBe(2)
  expect(result.totals.productViews).toBe(1)
  expect(result.totals.addToCarts).toBe(1)
  expect(result.totals.checkoutClicks).toBe(1)
  expect(result.funnel).toEqual({ visited: 1, viewedProduct: 1, addedToCart: 1, checkout: 1 })
  expect(result.checkoutBySource).toEqual([{ label: "Google", count: 1 }])
  expect(result.ctaClicks).toEqual([{ label: "Pop-up · Sign up", count: 1 }])
})

test("recordEvent ignores excessive events from one visitor", async () => {
  const t = convexTest(schema, modules)
  const asAdmin = await makeAdmin(t)

  for (let i = 0; i < 121; i++) {
    await t.mutation(api.analytics.recordEvent, {
      visitorId: "v-rate",
      type: "page_view",
      path: "/",
      label: "Home",
      source: "Direct",
    })
  }

  const r = buildRange("today", Date.now())
  const result = await asAdmin.query(api.analytics.getOverview, {
    buckets: r.buckets,
    prevStart: r.prevStart,
    prevEnd: r.prevEnd,
  })
  expect(result.totals.pageViews).toBe(120)
})

test("getOverview rejects non-admin", async () => {
  const t = convexTest(schema, modules)
  process.env.ADMIN_EMAILS = "admin@example.com"
  const r = buildRange("today", Date.now())
  await expect(
    t.query(api.analytics.getOverview, {
      buckets: r.buckets,
      prevStart: r.prevStart,
      prevEnd: r.prevEnd,
    }),
  ).rejects.toThrow()
})

test("getMarketingOverview tallies views, clicks, signups per item", async () => {
  const t = convexTest(schema, modules)
  const asAdmin = await makeAdmin(t)
  const now = Date.now()

  const { popupId, barId } = await t.run(async (ctx) => {
    const popupId = await ctx.db.insert("popups", {
      title: "Welcome",
      heading: "Welcome",
      text: "",
      buttonLabel: "Shop",
      buttonLink: "/",
      emailCaptureEnabled: true,
      delaySeconds: 2,
      frequency: "oncePerSession",
      isActive: true,
      position: "center",
      blurBackground: true,
      media: [],
      updatedAt: now,
    })
    const barId = await ctx.db.insert("announcementBars", {
      title: "Sale",
      text: "Sale on now",
      backgroundColor: "#000",
      textColor: "#fff",
      scope: "all",
      isActive: true,
      updatedAt: now,
    })
    const events = [
      { type: "popup_view" as const, path: popupId },
      { type: "popup_view" as const, path: popupId },
      { type: "popup_click" as const, path: popupId },
      { type: "announcement_view" as const, path: barId },
      { type: "announcement_click" as const, path: barId },
    ]
    for (const event of events) {
      await ctx.db.insert("analyticsEvents", { visitorId: "v0", ts: now - 1000, ...event })
    }
    await ctx.db.insert("popupEmailCaptures", { email: "a@b.com", source: "Welcome", popupId })
    return { popupId, barId }
  })

  const result = await asAdmin.query(api.analytics.getMarketingOverview, {
    since: now - 7 * 24 * 3600_000,
    until: now + 1000,
  })
  const popup = result.popups.find((p) => p.id === popupId)
  const bar = result.announcements.find((a) => a.id === barId)
  expect(popup).toMatchObject({ views: 2, clicks: 1, signups: 1 })
  expect(popup?.ctr).toBeCloseTo(0.5)
  expect(bar).toMatchObject({ views: 1, clicks: 1 })
  expect(result.totals.signups).toBe(1)
})

test("getMarketingItemStats returns all-time counts for one item", async () => {
  const t = convexTest(schema, modules)
  const asAdmin = await makeAdmin(t)
  const now = Date.now()
  const popupId = await t.run(async (ctx) => {
    const popupId = await ctx.db.insert("popups", {
      title: "Welcome",
      heading: "Welcome",
      text: "",
      buttonLabel: "",
      buttonLink: "",
      emailCaptureEnabled: true,
      delaySeconds: 0,
      frequency: "everyVisit",
      isActive: false,
      position: "center",
      blurBackground: false,
      media: [],
      updatedAt: now,
    })
    for (let i = 0; i < 3; i++) {
      await ctx.db.insert("analyticsEvents", {
        visitorId: `v${i}`,
        type: "popup_view",
        path: popupId,
        ts: now - i,
      })
    }
    await ctx.db.insert("popupEmailCaptures", { email: "x@y.com", source: "Welcome", popupId })
    return popupId
  })

  const stats = await asAdmin.query(api.analytics.getMarketingItemStats, {
    kind: "popup",
    id: popupId,
  })
  expect(stats).toMatchObject({ views: 3, clicks: 0, signups: 1 })
})

test("getProductsOverview estimates revenue from add-to-cart and price", async () => {
  const t = convexTest(schema, modules)
  const asAdmin = await makeAdmin(t)
  const now = Date.now()
  await t.run(async (ctx) => {
    await ctx.db.insert("catalogProducts", {
      shopifyProductId: "p1",
      shopifyHandle: "ember",
      title: "Ember",
      image: "",
      images: [],
      priceMin: 100,
      priceMax: 100,
      currencyCode: "USD",
      availableForSale: true,
      sortRank: 0,
      isVisible: true,
      syncedAt: now,
    })
    const rows = [
      { type: "product_view" as const, label: "Ember" },
      { type: "add_to_cart" as const, label: "Ember" },
      { type: "add_to_cart" as const, label: "Ember" },
      { type: "page_view" as const, label: "Collection: signature" },
    ]
    for (const row of rows) {
      await ctx.db.insert("analyticsEvents", { visitorId: "v0", ts: now - 1000, ...row })
    }
  })

  const result = await asAdmin.query(api.analytics.getProductsOverview, {
    since: now - 7 * 24 * 3600_000,
    until: now + 1000,
  })
  expect(result.topProducts).toEqual([{ label: "Ember", count: 1 }])
  expect(result.topCollections).toEqual([{ label: "signature", count: 1 }])
  expect(result.totalEstRevenue).toBe(200)
  expect(result.revenue[0]).toMatchObject({ label: "Ember", units: 2, estRevenue: 200 })
})
