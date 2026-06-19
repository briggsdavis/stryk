import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { requireAdmin } from "./admin"

const frequencyValidator = v.union(
  v.literal("everyVisit"),
  v.literal("oncePerSession"),
  v.literal("oncePerDay"),
)
const positionValidator = v.union(
  v.literal("center"),
  v.literal("top-left"),
  v.literal("top-right"),
  v.literal("bottom-left"),
  v.literal("bottom-right"),
  v.literal("top"),
  v.literal("bottom"),
  v.literal("left"),
  v.literal("right"),
)
const mediaValidator = v.array(
  v.object({
    type: v.union(v.literal("image"), v.literal("video")),
    storageId: v.id("_storage"),
  }),
)

// ── Announcement bar ─────────────────────────────────────────────────────────

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
      await ctx.db.patch(announcement._id, { isActive: false, updatedAt: Date.now() })
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
    if (!announcement) return null
    // "off" is legacy data; treat it as "all" so an active bar still shows.
    const scope = announcement.scope === "off" ? "all" : announcement.scope
    if (scope === "home" && args.route !== "home") return null
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
    // Which pages the bar shows on. On/off is controlled separately via the
    // active toggle, so "off" is no longer set here.
    scope: v.union(v.literal("home"), v.literal("all")),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const now = Date.now()

    // Only one announcement bar can be live at a time.
    if (args.isActive) {
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
      isActive: args.isActive,
      updatedAt: now,
    }

    if (args.id) {
      await ctx.db.patch(args.id, doc)
      return args.id
    }

    return await ctx.db.insert("announcementBars", doc)
  },
})

export const setAnnouncementActive = mutation({
  args: { id: v.id("announcementBars"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    if (args.isActive) {
      await deactivateActiveAnnouncements(ctx, args.id)
    }
    await ctx.db.patch(args.id, { isActive: args.isActive, updatedAt: Date.now() })
  },
})

export const deleteAnnouncement = mutation({
  args: { id: v.id("announcementBars") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    await ctx.db.delete(args.id)
  },
})

// ── Popups ───────────────────────────────────────────────────────────────────

async function resolveMedia(ctx: QueryCtx, popup: Doc<"popups">) {
  // Legacy/in-progress rows may predate the `media` field; default to an empty
  // carousel so the editor can still load (and let the admin re-save) instead
  // of the whole query throwing a masked "Server Error".
  const media = await Promise.all(
    (popup.media ?? []).map(async (item) => {
      // A single bad/deleted/malformed storageId must not take down the whole
      // query (which would crash both the admin editor and the public popup +
      // announcement bar, since they share this resolver behind an error
      // boundary). Fall back to a null url so the carousel just skips it.
      let url: string | null = null
      try {
        url = await ctx.storage.getUrl(item.storageId)
      } catch {
        url = null
      }
      return { type: item.type, storageId: item.storageId, url }
    }),
  )
  return { ...popup, media }
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

export const listPopups = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const popups = await ctx.db.query("popups").withIndex("by_updatedAt").order("desc").take(50)
    return await Promise.all(popups.map((popup) => resolveMedia(ctx, popup)))
  },
})

export const activePopups = query({
  args: {},
  handler: async (ctx) => {
    const popups = await ctx.db
      .query("popups")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .take(20)
    return await Promise.all(popups.map((popup) => resolveMedia(ctx, popup)))
  },
})

export const savePopup = mutation({
  args: {
    id: v.optional(v.id("popups")),
    title: v.string(),
    heading: v.string(),
    text: v.string(),
    buttonLabel: v.string(),
    buttonLink: v.string(),
    emailCaptureEnabled: v.boolean(),
    delaySeconds: v.number(),
    frequency: frequencyValidator,
    isActive: v.boolean(),
    position: positionValidator,
    blurBackground: v.boolean(),
    media: mediaValidator,
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const { id, ...rest } = args
    const doc = { ...rest, updatedAt: Date.now() }

    if (id) {
      // Free any storage files that were dropped from the carousel.
      const existing = await ctx.db.get(id)
      if (existing) {
        const keptIds = new Set(args.media.map((m) => m.storageId))
        for (const item of existing.media ?? []) {
          if (!keptIds.has(item.storageId)) {
            await ctx.storage.delete(item.storageId)
          }
        }
      }
      await ctx.db.patch(id, doc)
      return id
    }

    return await ctx.db.insert("popups", doc)
  },
})

export const setPopupActive = mutation({
  args: { id: v.id("popups"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    // Multiple popups may be active at once, so just flip this one.
    await ctx.db.patch(args.id, { isActive: args.isActive, updatedAt: Date.now() })
  },
})

export const deletePopup = mutation({
  args: { id: v.id("popups") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const popup = await ctx.db.get(args.id)
    if (popup) {
      for (const item of popup.media ?? []) {
        await ctx.storage.delete(item.storageId)
      }
    }
    await ctx.db.delete(args.id)
  },
})
