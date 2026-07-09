import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import type { QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { requireAdmin } from "./admin"

const imageValidator = v.union(
  v.object({ url: v.string() }),
  v.object({ storageId: v.id("_storage") }),
)
const accordionItemValidator = v.object({ question: v.string(), answer: v.string() })
const aboutValueValidator = v.object({
  label: v.string(),
  body: v.string(),
  image: imageValidator,
})

type PageImage = { url: string } | { storageId: Id<"_storage"> }

const DEFAULT_ABOUT = {
  eyebrow: "About Stryk Studios",
  heading: "Vintage charm, modern walls",
  heroImage: {
    url: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1600&q=80",
  },
  philosophyEyebrow: "Our Philosophy",
  philosophyBody:
    "Stryk Studios sources matchboxes and matchbooks from flea markets, estate sales, and specialist dealers across four continents - and brings the best of them home as art.",
  philosophyMeta: "Est. 2021 - New York",
  philosophyImages: [
    {
      url: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=900&h=900&fit=crop&q=80",
    },
    {
      url: "https://images.unsplash.com/photo-1597696929736-6d13bed8e6a8?w=900&h=900&fit=crop&q=80",
    },
  ],
  driversEyebrow: "What drives us",
  visionLabel: "Vision",
  visionBody: "Everyday objects, recognised as the art they always were.",
  visionImage: {
    url: "https://images.unsplash.com/photo-1610219171189-286769cc9b20?w=1000&h=1000&fit=crop&q=80",
  },
  missionLabel: "Mission",
  missionBody: "To surface the world's forgotten matchbox art and give it a home.",
  missionImage: {
    url: "https://images.unsplash.com/photo-1626897885636-dd68020cc52a?w=1000&h=1000&fit=crop&q=80",
  },
  storyEyebrow: "Our Story",
  storyHeading: "Found in a Tokyo flea market",
  storyBody:
    "It began in 2021 with a box of mid-century Japanese matchbooks from a Shimokitazawa market - tiny, perfect labels unlike anything in any gallery. We've been hunting ever since.",
  storyHeroImage: {
    url: "https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?w=1200&h=1600&fit=crop&q=80",
  },
  storyDetailImage: {
    url: "https://images.unsplash.com/photo-1598048851887-0263d4f43e73?w=1000&h=1000&fit=crop&q=80",
  },
  valuesEyebrow: "What we stand for",
  values: [
    {
      label: "Curation",
      body: "We don't list everything we find. Only pieces that stop us in our tracks make it to the store.",
      image: {
        url: "https://images.unsplash.com/photo-1617784625140-515e220ba148?w=800&h=800&fit=crop&q=80",
      },
    },
    {
      label: "Discovery",
      body: "Every matchbox is a portal - to a city, a decade, a brand that no longer exists. We live for that feeling.",
      image: {
        url: "https://images.unsplash.com/photo-1594368247117-6012a8acda3e?w=800&h=800&fit=crop&q=80",
      },
    },
    {
      label: "Craft",
      body: "The designers who made these labels had no digital tools, only instinct and a tight deadline. That tension shows in every line.",
      image: {
        url: "https://images.unsplash.com/photo-1551807306-4bcd16b92a41?w=800&h=800&fit=crop&q=80",
      },
    },
    {
      label: "Story",
      body: "No object without context. Every piece we sell comes with the history it earned.",
      image: {
        url: "https://images.unsplash.com/photo-1619367302084-3d07eb49159f?w=800&h=800&fit=crop&q=80",
      },
    },
  ],
  sustainabilityEyebrow: "Sustainability",
  sustainabilityHeading: "How we work",
  sustainabilityItems: [
    {
      question: "Authentic sourcing",
      answer:
        "Every piece is sourced directly from estate sales, flea markets, and specialist dealers across Japan, Kenya, France, Germany, Italy, and the United States. We verify provenance before anything reaches our shelves.",
    },
    {
      question: "Historical accuracy",
      answer:
        "We research every label - dating it, identifying the brand, and tracing its regional context. What you receive comes with a record of its story, not just its image.",
    },
    {
      question: "Responsible preservation",
      answer:
        "Vintage paper is fragile. We archive originals in archival-grade sleeves and produce reprints only on acid-free stock, ensuring the work survives another hundred years.",
    },
    {
      question: "Sustainable packaging",
      answer:
        "All packaging is made from recycled or FSC-certified materials and is fully recyclable. We've eliminated all single-use plastics from our supply chain.",
    },
  ],
}

const DEFAULT_CONTACT = {
  eyebrow: "Get in touch",
  heading: "Tell us what you're hunting for",
  studioName: "Stryk Studios",
  address: "1234 Maker Street\nNew York, NY 10001",
  faqHeading: "FAQ",
  faqs: [
    {
      question: "Are these original pieces or reprints?",
      answer:
        "Both. Each listing specifies whether it is an original vintage piece, a limited archival reprint, or a framed reproduction. Originals are one-of-a-kind; reprints are produced in numbered runs on acid-free stock.",
    },
    {
      question: "Do you ship internationally?",
      answer:
        "Yes - we ship worldwide. All pieces are wrapped in archival tissue and packed in rigid board mailers to survive the journey. Tracking is included on every order.",
    },
    {
      question: "Can I request a piece from a specific country or era?",
      answer:
        "Absolutely. Use the contact form to describe what you're after - city, decade, style - and we'll search our current stock and upcoming sourcing trips for a match.",
    },
  ],
}

const DEFAULT_GLOBAL = {
  email: "info@stryk.co",
  phone: "+1 212 555 0100",
}

async function resolveImage(ctx: QueryCtx, image: PageImage) {
  if ("url" in image) return { source: image, url: image.url }
  const url = await ctx.storage.getUrl(image.storageId)
  if (!url) throw new Error("A page image is missing from Convex storage.")
  return { source: image, url }
}

async function resolveAbout(ctx: QueryCtx, settings?: Doc<"aboutPageSettings"> | null) {
  const content = settings ?? { ...DEFAULT_ABOUT, key: "about" as const, updatedAt: 0 }
  const [
    heroImage,
    philosophyImages,
    visionImage,
    missionImage,
    storyHeroImage,
    storyDetailImage,
    values,
  ] = await Promise.all([
    resolveImage(ctx, content.heroImage),
    Promise.all(content.philosophyImages.map((image) => resolveImage(ctx, image))),
    resolveImage(ctx, content.visionImage),
    resolveImage(ctx, content.missionImage),
    resolveImage(ctx, content.storyHeroImage),
    resolveImage(ctx, content.storyDetailImage),
    Promise.all(
      content.values.map(async (value) => ({
        ...value,
        image: await resolveImage(ctx, value.image),
      })),
    ),
  ])
  return {
    ...content,
    heroImage,
    philosophyImages,
    visionImage,
    missionImage,
    storyHeroImage,
    storyDetailImage,
    values,
  }
}

export const getAbout = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db
      .query("aboutPageSettings")
      .withIndex("by_key", (q) => q.eq("key", "about"))
      .unique()
    return await resolveAbout(ctx, settings)
  },
})

export const getAboutForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const settings = await ctx.db
      .query("aboutPageSettings")
      .withIndex("by_key", (q) => q.eq("key", "about"))
      .unique()
    return await resolveAbout(ctx, settings)
  },
})

export const saveAbout = mutation({
  args: {
    eyebrow: v.string(),
    heading: v.string(),
    heroImage: imageValidator,
    philosophyEyebrow: v.string(),
    philosophyBody: v.string(),
    philosophyMeta: v.string(),
    philosophyImages: v.array(imageValidator),
    driversEyebrow: v.string(),
    visionLabel: v.string(),
    visionBody: v.string(),
    visionImage: imageValidator,
    missionLabel: v.string(),
    missionBody: v.string(),
    missionImage: imageValidator,
    storyEyebrow: v.string(),
    storyHeading: v.string(),
    storyBody: v.string(),
    storyHeroImage: imageValidator,
    storyDetailImage: imageValidator,
    valuesEyebrow: v.string(),
    values: v.array(aboutValueValidator),
    sustainabilityEyebrow: v.string(),
    sustainabilityHeading: v.string(),
    sustainabilityItems: v.array(accordionItemValidator),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const existing = await ctx.db
      .query("aboutPageSettings")
      .withIndex("by_key", (q) => q.eq("key", "about"))
      .unique()
    const doc = { ...args, key: "about" as const, updatedAt: Date.now() }
    if (existing) await ctx.db.replace(existing._id, doc)
    else await ctx.db.insert("aboutPageSettings", doc)
    return null
  },
})

export const getContact = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db
      .query("contactPageSettings")
      .withIndex("by_key", (q) => q.eq("key", "contact"))
      .unique()
    return settings ?? { ...DEFAULT_CONTACT, key: "contact" as const, updatedAt: 0 }
  },
})

export const getContactForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const settings = await ctx.db
      .query("contactPageSettings")
      .withIndex("by_key", (q) => q.eq("key", "contact"))
      .unique()
    return settings ?? { ...DEFAULT_CONTACT, key: "contact" as const, updatedAt: 0 }
  },
})

export const saveContact = mutation({
  args: {
    eyebrow: v.string(),
    heading: v.string(),
    studioName: v.string(),
    address: v.string(),
    faqHeading: v.string(),
    faqs: v.array(accordionItemValidator),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const existing = await ctx.db
      .query("contactPageSettings")
      .withIndex("by_key", (q) => q.eq("key", "contact"))
      .unique()
    const doc = { ...args, key: "contact" as const, updatedAt: Date.now() }
    if (existing) await ctx.db.replace(existing._id, doc)
    else await ctx.db.insert("contactPageSettings", doc)
    return null
  },
})

export const getGlobal = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db
      .query("globalPageSettings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique()
    return settings ?? { ...DEFAULT_GLOBAL, key: "global" as const, updatedAt: 0 }
  },
})

export const getGlobalForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const settings = await ctx.db
      .query("globalPageSettings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique()
    return settings ?? { ...DEFAULT_GLOBAL, key: "global" as const, updatedAt: 0 }
  },
})

export const saveGlobal = mutation({
  args: { email: v.string(), phone: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const existing = await ctx.db
      .query("globalPageSettings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique()
    const doc = { ...args, key: "global" as const, updatedAt: Date.now() }
    if (existing) await ctx.db.replace(existing._id, doc)
    else await ctx.db.insert("globalPageSettings", doc)
    return null
  },
})

export const generateImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})
