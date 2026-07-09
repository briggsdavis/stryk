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
    // Whether the call-to-action button is shown. Optional so pre-toggle rows
    // stay valid; those default in code to "shown when a label + link exist".
    buttonEnabled: v.optional(v.boolean()),
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
    // Trigger model. A pop-up is EITHER time-triggered (shown after a delay on
    // the targeted `pages`) OR action-triggered (shown when `action` fires).
    // The two are mutually exclusive. Optional so pre-trigger rows stay valid;
    // those default to time/["home"] in code.
    triggerType: v.optional(v.union(v.literal("time"), v.literal("action"))),
    pages: v.optional(
      v.array(
        v.union(
          v.literal("home"),
          v.literal("about"),
          v.literal("contact"),
          v.literal("collection"),
        ),
      ),
    ),
    action: v.optional(v.union(v.literal("filter"), v.literal("product"), v.literal("collection"))),
    // Up to 5 carousel slides; images and video may be mixed.
    media: v.array(
      v.object({
        type: v.union(v.literal("image"), v.literal("video")),
        storageId: v.id("_storage"),
      }),
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
    // The pop-up this email was captured through, when known. Optional so
    // legacy rows (and the rare capture with no owning pop-up) stay valid.
    // Used to count sign-ups per pop-up in the analytics dashboard.
    popupId: v.optional(v.id("popups")),
  })
    .index("by_email", ["email"])
    .index("by_source", ["source"])
    .index("by_popupId", ["popupId"]),
  // Cookieless behavioural analytics. One row per tracked interaction on the
  // public site. `visitorId` is a random id kept in the browser's localStorage
  // (no PII); `ts` is the server-stamped event time so range queries stay
  // reliable regardless of client clock skew.
  analyticsEvents: defineTable({
    visitorId: v.string(),
    type: v.union(
      v.literal("page_view"),
      v.literal("product_view"),
      v.literal("add_to_cart"),
      v.literal("checkout_click"),
      v.literal("cta_click"),
      // Marketing surfaces: a pop-up or announcement bar was shown to a
      // visitor (…_view) or its action button was clicked (…_click). For these
      // the `path` field carries the pop-up / announcement document id so the
      // dashboard can count impressions and clicks per item.
      v.literal("popup_view"),
      v.literal("popup_click"),
      v.literal("announcement_view"),
      v.literal("announcement_click"),
    ),
    // Route path for page views; product handle/id context otherwise; the
    // pop-up / announcement document id for marketing events.
    path: v.optional(v.string()),
    // Human-readable label: page name, product title, or CTA button text.
    label: v.optional(v.string()),
    // Traffic source for the visitor's session (Direct, Google, a referrer
    // host) — attached to every event so any metric can break down by source.
    source: v.optional(v.string()),
    ts: v.number(),
  })
    .index("by_type_and_ts", ["type", "ts"])
    .index("by_type_and_path", ["type", "path"])
    .index("by_visitorId_and_ts", ["visitorId", "ts"])
    .index("by_ts", ["ts"]),
  catalogProducts: defineTable({
    shopifyProductId: v.string(),
    shopifyHandle: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    image: v.string(),
    images: v.array(v.string()),
    priceMin: v.number(),
    priceMax: v.number(),
    currencyCode: v.string(),
    firstAvailableVariantId: v.optional(v.string()),
    availableForSale: v.boolean(),
    colorKey: v.optional(v.string()),
    colorLabel: v.optional(v.string()),
    categoryKey: v.optional(v.string()),
    categoryLabel: v.optional(v.string()),
    primaryCollectionHandle: v.optional(v.string()),
    primaryCollectionTitle: v.optional(v.string()),
    sortRank: v.number(),
    isVisible: v.boolean(),
    shopifyUpdatedAt: v.optional(v.string()),
    syncedAt: v.number(),
  })
    .index("by_shopifyProductId", ["shopifyProductId"])
    .index("by_shopifyHandle", ["shopifyHandle"])
    .index("by_isVisible_and_sortRank", ["isVisible", "sortRank"])
    .index("by_isVisible_and_colorKey_and_sortRank", ["isVisible", "colorKey", "sortRank"])
    .index("by_isVisible_and_categoryKey_and_sortRank", ["isVisible", "categoryKey", "sortRank"])
    .index("by_syncedAt", ["syncedAt"]),
  catalogCollections: defineTable({
    shopifyCollectionId: v.string(),
    shopifyHandle: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    image: v.optional(v.string()),
    tagline: v.optional(v.string()),
    materials: v.optional(v.string()),
    palette: v.optional(v.string()),
    sortRank: v.number(),
    isVisible: v.boolean(),
    shopifyUpdatedAt: v.optional(v.string()),
    syncedAt: v.number(),
  })
    .index("by_shopifyCollectionId", ["shopifyCollectionId"])
    .index("by_shopifyHandle", ["shopifyHandle"])
    .index("by_isVisible_and_sortRank", ["isVisible", "sortRank"])
    .index("by_syncedAt", ["syncedAt"]),
  collectionPageSettings: defineTable({
    collectionId: v.id("catalogCollections"),
    collectionHandle: v.string(),
    heroImages: v.array(v.id("_storage")),
    specs: v.array(
      v.object({
        label: v.string(),
        value: v.string(),
      }),
    ),
    updatedAt: v.number(),
  })
    .index("by_collectionId", ["collectionId"])
    .index("by_collectionHandle", ["collectionHandle"]),
  aboutPageSettings: defineTable({
    key: v.literal("about"),
    eyebrow: v.string(),
    heading: v.string(),
    heroImage: v.union(v.object({ url: v.string() }), v.object({ storageId: v.id("_storage") })),
    philosophyEyebrow: v.string(),
    philosophyBody: v.string(),
    philosophyMeta: v.string(),
    philosophyImages: v.array(
      v.union(v.object({ url: v.string() }), v.object({ storageId: v.id("_storage") })),
    ),
    driversEyebrow: v.string(),
    visionLabel: v.string(),
    visionBody: v.string(),
    visionImage: v.union(v.object({ url: v.string() }), v.object({ storageId: v.id("_storage") })),
    missionLabel: v.string(),
    missionBody: v.string(),
    missionImage: v.union(v.object({ url: v.string() }), v.object({ storageId: v.id("_storage") })),
    storyEyebrow: v.string(),
    storyHeading: v.string(),
    storyBody: v.string(),
    storyHeroImage: v.union(
      v.object({ url: v.string() }),
      v.object({ storageId: v.id("_storage") }),
    ),
    storyDetailImage: v.union(
      v.object({ url: v.string() }),
      v.object({ storageId: v.id("_storage") }),
    ),
    valuesEyebrow: v.string(),
    values: v.array(
      v.object({
        label: v.string(),
        body: v.string(),
        image: v.union(v.object({ url: v.string() }), v.object({ storageId: v.id("_storage") })),
      }),
    ),
    sustainabilityEyebrow: v.string(),
    sustainabilityHeading: v.string(),
    sustainabilityItems: v.array(v.object({ question: v.string(), answer: v.string() })),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
  contactPageSettings: defineTable({
    key: v.literal("contact"),
    eyebrow: v.string(),
    heading: v.string(),
    studioName: v.string(),
    address: v.string(),
    faqHeading: v.string(),
    faqs: v.array(v.object({ question: v.string(), answer: v.string() })),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
  globalPageSettings: defineTable({
    key: v.literal("global"),
    email: v.string(),
    phone: v.string(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
  catalogProductCollections: defineTable({
    productId: v.id("catalogProducts"),
    collectionId: v.id("catalogCollections"),
    collectionHandle: v.string(),
    sortRank: v.number(),
    syncedAt: v.number(),
  })
    .index("by_productId", ["productId"])
    .index("by_collectionHandle_and_sortRank", ["collectionHandle", "sortRank"])
    .index("by_collectionId_and_productId", ["collectionId", "productId"])
    .index("by_productId_and_collectionHandle", ["productId", "collectionHandle"]),
  catalogProductVariants: defineTable({
    productId: v.id("catalogProducts"),
    shopifyProductId: v.string(),
    shopifyVariantId: v.string(),
    title: v.string(),
    sku: v.optional(v.string()),
    artworkKey: v.optional(v.string()),
    artworkLabel: v.optional(v.string()),
    sizeKey: v.optional(v.string()),
    sizeLabel: v.optional(v.string()),
    frameKey: v.optional(v.string()),
    frameLabel: v.optional(v.string()),
    image: v.optional(v.string()),
    price: v.number(),
    currencyCode: v.string(),
    availableForSale: v.boolean(),
    sortRank: v.number(),
    syncedAt: v.number(),
  })
    .index("by_productId_and_sortRank", ["productId", "sortRank"])
    .index("by_shopifyVariantId", ["shopifyVariantId"])
    .index("by_productId_and_artworkKey_and_sizeKey_and_frameKey", [
      "productId",
      "artworkKey",
      "sizeKey",
      "frameKey",
    ]),
  catalogProductIndexEntries: defineTable({
    filterKey: v.string(),
    productId: v.id("catalogProducts"),
    sortRank: v.number(),
    syncedAt: v.number(),
  })
    .index("by_filterKey_and_sortRank", ["filterKey", "sortRank"])
    .index("by_productId", ["productId"]),
  catalogFacetOptions: defineTable({
    dimension: v.union(v.literal("color"), v.literal("category")),
    value: v.string(),
    label: v.string(),
    swatch: v.optional(v.string()),
    sortRank: v.number(),
    isVisible: v.boolean(),
    syncedAt: v.number(),
  })
    .index("by_dimension_and_value", ["dimension", "value"])
    .index("by_dimension_and_sortRank", ["dimension", "sortRank"])
    .index("by_syncedAt", ["syncedAt"]),
})
