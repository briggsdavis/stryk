import { authTables } from "@convex-dev/auth/server"
import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  ...authTables,
  announcementBars: defineTable({
    title: v.string(),
    text: v.string(),
    buttonLabel: v.optional(v.string()),
    buttonLink: v.optional(v.string()),
    backgroundColor: v.string(),
    textColor: v.string(),
    scope: v.union(v.literal("off"), v.literal("home"), v.literal("all")),
    isActive: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_isActive", ["isActive"])
    .index("by_updatedAt", ["updatedAt"]),
  // Legacy single-popup table. Superseded by `popups` (a saved collection);
  // kept in the schema so existing rows remain valid. No longer read/written.
  popupSettings: defineTable({
    key: v.literal("site"),
    isActive: v.boolean(),
    imageUrl: v.string(),
    heading: v.string(),
    text: v.string(),
    buttonLabel: v.string(),
    buttonLink: v.string(),
    emailCaptureEnabled: v.boolean(),
    delaySeconds: v.number(),
    frequency: v.union(
      v.literal("everyVisit"),
      v.literal("oncePerSession"),
      v.literal("oncePerDay"),
    ),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
  popups: defineTable({
    title: v.string(),
    heading: v.string(),
    text: v.string(),
    buttonLabel: v.string(),
    buttonLink: v.string(),
    emailCaptureEnabled: v.boolean(),
    delaySeconds: v.number(),
    frequency: v.union(
      v.literal("everyVisit"),
      v.literal("oncePerSession"),
      v.literal("oncePerDay"),
    ),
    isActive: v.boolean(),
    // Where the popup is anchored on screen and how it slides in.
    position: v.union(
      v.literal("center"),
      v.literal("top-left"),
      v.literal("top-right"),
      v.literal("bottom-left"),
      v.literal("bottom-right"),
      v.literal("top"),
      v.literal("bottom"),
      v.literal("left"),
      v.literal("right"),
    ),
    // When false the rest of the page stays visible/interactive (no backdrop).
    blurBackground: v.boolean(),
    // Up to 5 carousel slides; images and video may be mixed. Optional because
    // rows created before this field existed have no media array — a required
    // validator would make the schema push reject those rows and block the
    // whole deploy. Writers always set it; readers tolerate it being absent.
    media: v.optional(
      v.array(
        v.object({
          type: v.union(v.literal("image"), v.literal("video")),
          storageId: v.id("_storage"),
        }),
      ),
    ),
    updatedAt: v.number(),
  })
    .index("by_isActive", ["isActive"])
    .index("by_updatedAt", ["updatedAt"]),
  contactInquiries: defineTable({
    inquiryType: v.union(v.literal("general"), v.literal("custom"), v.literal("order")),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    reference: v.optional(v.string()),
    size: v.optional(v.string()),
    message: v.string(),
    status: v.union(v.literal("new"), v.literal("read"), v.literal("archived")),
  }).index("by_status", ["status"]),
  popupEmailCaptures: defineTable({
    email: v.string(),
    source: v.string(),
  }).index("by_email", ["email"]),
})
