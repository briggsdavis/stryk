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
    frequency: v.union(v.literal("everyVisit"), v.literal("oncePerSession"), v.literal("oncePerDay")),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
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
