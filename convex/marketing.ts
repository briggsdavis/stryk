import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { requireAdmin } from "./admin"

const scopeValidator = v.union(v.literal("off"), v.literal("home"), v.literal("all"))
const frequencyValidator = v.union(
  v.literal("everyVisit"),
  v.literal("oncePerSession"),
  v.literal("oncePerDay"),
)

async function deactivateActiveAnnouncements(
  ctx: MutationCtx,
  exceptId?: Id<"announcementBars">,
) {
  const active = await ctx.db
    .query("announcementBars")
    .withIndex("by_isActive", (q) => q.eq("isActive", true))
    .take(20)

  for (const announcement of active) {
    if (announcement._id !== exceptId) {
      await ctx.db.patch(announcement._id, { isActive: false, scope: "off", updatedAt: Date.now() })
    }
  }
}

export const listAnnouncements = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    return await ctx.db.query("announcementBars").withIndex("by_updatedAt").order("desc").take(50)
  },
})

export const activeAnnouncement = query({
  args: { route: v.union(v.literal("home"), v.literal("other")) },
  handler: async (ctx, args) => {
    const active = await ctx.db
      .query("announcementBars")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .take(1)
    const announcement = active[0] ?? null
    if (!announcement || announcement.scope === "off") return null
    if (announcement.scope === "home" && args.route !== "home") return null
    return announcement
  },
})

export const saveAnnouncement = mutation({
  args: {
    id: v.optional(v.id("announcementBars")),
    title: v.string(),
    text: v.string(),
    buttonLabel: v.optional(v.string()),
    buttonLink: v.optional(v.string()),
    backgroundColor: v.string(),
    textColor: v.string(),
    scope: scopeValidator,
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const now = Date.now()
    const isActive = args.isActive && args.scope !== "off"

    if (isActive) {
      await deactivateActiveAnnouncements(ctx, args.id)
    }

    const doc = {
      title: args.title,
      text: args.text,
      buttonLabel: args.buttonLabel,
      buttonLink: args.buttonLink,
      backgroundColor: args.backgroundColor,
      textColor: args.textColor,
      scope: args.scope,
      isActive,
      updatedAt: now,
    }

    if (args.id) {
      await ctx.db.patch(args.id, doc)
      return args.id
    }

    return await ctx.db.insert("announcementBars", doc)
  },
})

export const activateAnnouncement = mutation({
  args: { id: v.id("announcementBars"), scope: scopeValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    await deactivateActiveAnnouncements(ctx, args.id)
    await ctx.db.patch(args.id, {
      isActive: args.scope !== "off",
      scope: args.scope,
      updatedAt: Date.now(),
    })
  },
})

export const getPopup = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("popupSettings")
      .withIndex("by_key", (q) => q.eq("key", "site"))
      .unique()
  },
})

export const getPopupForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    return await ctx.db
      .query("popupSettings")
      .withIndex("by_key", (q) => q.eq("key", "site"))
      .unique()
  },
})

export const savePopup = mutation({
  args: {
    isActive: v.boolean(),
    imageUrl: v.string(),
    heading: v.string(),
    text: v.string(),
    buttonLabel: v.string(),
    buttonLink: v.string(),
    emailCaptureEnabled: v.boolean(),
    delaySeconds: v.number(),
    frequency: frequencyValidator,
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const existing = await ctx.db
      .query("popupSettings")
      .withIndex("by_key", (q) => q.eq("key", "site"))
      .unique()
    const doc = { key: "site" as const, ...args, updatedAt: Date.now() }

    if (existing) {
      await ctx.db.patch(existing._id, doc)
      return existing._id
    }

    return await ctx.db.insert("popupSettings", doc)
  },
})
