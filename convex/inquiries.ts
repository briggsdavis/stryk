import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { requireAdmin } from "./admin"

const inquiryType = v.union(v.literal("general"), v.literal("custom"), v.literal("order"))
const status = v.union(v.literal("new"), v.literal("read"), v.literal("archived"))

export const submitContact = mutation({
  args: {
    inquiryType,
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    reference: v.optional(v.string()),
    size: v.optional(v.string()),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("contactInquiries", {
      ...args,
      status: "new",
    })
  },
})

export const capturePopupEmail = mutation({
  args: {
    email: v.string(),
    source: v.string(),
    // The pop-up this email came through, when known — powers per-pop-up
    // sign-up counts in the analytics dashboard.
    popupId: v.optional(v.id("popups")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("popupEmailCaptures", {
      email: args.email.trim().toLowerCase(),
      source: args.source,
      popupId: args.popupId,
    })
  },
})

export const listContactInquiries = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    return await ctx.db.query("contactInquiries").order("desc").take(100)
  },
})

export const listPopupEmailCaptures = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    return await ctx.db.query("popupEmailCaptures").order("desc").take(100)
  },
})

export const updateInquiryStatus = mutation({
  args: {
    id: v.id("contactInquiries"),
    status,
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    await ctx.db.patch(args.id, { status: args.status })
  },
})
