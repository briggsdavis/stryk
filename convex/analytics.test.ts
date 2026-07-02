/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { expect, test } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"
import { buildRange } from "../src/lib/analytics-ranges"

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
