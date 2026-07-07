/* eslint-disable no-await-in-loop */
import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import { internalMutation, mutation, query } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { requireAdmin } from "./admin"

const filterValidator = v.object({
  color: v.array(v.string()),
  category: v.array(v.string()),
  collection: v.array(v.string()),
})

const collectionPageSpecValidator = v.object({
  label: v.string(),
  value: v.string(),
})

const syncedCollectionValidator = v.object({
  shopifyCollectionId: v.string(),
  shopifyHandle: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
  image: v.optional(v.string()),
  sortRank: v.number(),
  isVisible: v.boolean(),
  shopifyUpdatedAt: v.optional(v.string()),
})

const syncedVariantValidator = v.object({
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
})

const syncedProductValidator = v.object({
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
  collections: v.array(syncedCollectionValidator),
  variants: v.array(syncedVariantValidator),
})

type ActiveFilters = {
  color: string[]
  category: string[]
  collection: string[]
}

function clean(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).toSorted()
}

function combinations(groups: string[][]): string[][] {
  return groups.reduce<string[][]>(
    (acc, group) => acc.flatMap((prefix) => group.map((value) => [...prefix, value])),
    [[]],
  )
}

function buildFilterKeys(filters: ActiveFilters) {
  const groups = [
    clean(filters.color).map((value) => `color:${value}`),
    clean(filters.category).map((value) => `category:${value}`),
    clean(filters.collection).map((value) => `collection:${value}`),
  ].filter((group) => group.length > 0)

  if (groups.length === 0) return ["all"]
  return combinations(groups).map((parts) => parts.join("|"))
}

function buildProductFilterKeys(product: {
  colorKey?: string
  categoryKey?: string
  collections: { shopifyHandle: string }[]
}) {
  const colorParts = product.colorKey ? [`color:${product.colorKey}`] : []
  const categoryParts = product.categoryKey ? [`category:${product.categoryKey}`] : []
  const collectionParts = product.collections.map((c) => `collection:${c.shopifyHandle}`)
  const dimensions = [colorParts, categoryParts, collectionParts].filter((g) => g.length > 0)
  const keys = new Set(["all"])

  for (let mask = 1; mask < 1 << dimensions.length; mask++) {
    const groups = dimensions.filter((_, i) => (mask & (1 << i)) !== 0)
    for (const combo of combinations(groups)) keys.add(combo.join("|"))
  }

  return Array.from(keys)
}

function parseCursor(cursor: string | null): Record<string, number> {
  if (!cursor) return {}
  try {
    const parsed = JSON.parse(cursor) as unknown
    if (!parsed || typeof parsed !== "object") return {}
    const result: Record<string, number> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number") result[key] = value
    }
    return result
  } catch {
    return {}
  }
}

function serializeCursor(cursor: Record<string, number>) {
  return JSON.stringify(cursor)
}

async function deleteByProductId(
  ctx: MutationCtx,
  table: "catalogProductCollections" | "catalogProductIndexEntries" | "catalogProductVariants",
  productId: Id<"catalogProducts">,
) {
  const rows =
    table === "catalogProductVariants"
      ? await ctx.db
          .query("catalogProductVariants")
          .withIndex("by_productId_and_sortRank", (q) => q.eq("productId", productId))
          .take(2048)
      : table === "catalogProductCollections"
        ? await ctx.db
            .query("catalogProductCollections")
            .withIndex("by_productId", (q) => q.eq("productId", productId))
            .take(2048)
        : await ctx.db
            .query("catalogProductIndexEntries")
            .withIndex("by_productId", (q) => q.eq("productId", productId))
            .take(2048)

  for (const row of rows) {
    await ctx.db.delete(row._id)
  }
}

async function markVariantsUnavailable(
  ctx: MutationCtx,
  productId: Id<"catalogProducts">,
  syncedAt: number,
) {
  const rows = await ctx.db
    .query("catalogProductVariants")
    .withIndex("by_productId_and_sortRank", (q) => q.eq("productId", productId))
    .take(2048)

  for (const row of rows) {
    if (row.availableForSale || row.syncedAt !== syncedAt) {
      await ctx.db.patch(row._id, { availableForSale: false, syncedAt })
    }
  }
}

async function upsertFacetOption(
  ctx: MutationCtx,
  dimension: "color" | "category",
  value: string | undefined,
  label: string | undefined,
  now: number,
) {
  if (!value || !label) return
  const existing = await ctx.db
    .query("catalogFacetOptions")
    .withIndex("by_dimension_and_value", (q) => q.eq("dimension", dimension).eq("value", value))
    .unique()
  const doc = {
    dimension,
    value,
    label,
    sortRank: label.toLowerCase().charCodeAt(0),
    isVisible: true,
    syncedAt: now,
  }
  if (existing) await ctx.db.patch(existing._id, doc)
  else await ctx.db.insert("catalogFacetOptions", doc)
}

function cleanCollectionSpecs(specs: { label: string; value: string }[]) {
  if (specs.length !== 3) {
    throw new Error("Collection pages must have exactly three specification rows.")
  }

  const cleaned = specs.map((spec) => ({
    label: spec.label.trim(),
    value: spec.value.trim(),
  }))

  if (cleaned.some((spec) => !spec.label || !spec.value)) {
    throw new Error("Every specification row needs a label and value.")
  }

  return cleaned
}

async function resolveCollectionPageSettings(
  ctx: QueryCtx,
  settings: Doc<"collectionPageSettings">,
) {
  const heroImages = await Promise.all(
    settings.heroImages.map(async (storageId) => {
      const url = await ctx.storage.getUrl(storageId)
      if (!url) throw new Error("A collection page image is missing from Convex storage.")
      return { storageId, url }
    }),
  )

  if (heroImages.length !== 4) {
    throw new Error("Collection page settings must have exactly four images.")
  }

  return { ...settings, heroImages }
}

export const listProducts = query({
  args: {
    filters: filterValidator,
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.paginationOpts.numItems, 1), 150)
    const filterKeys = buildFilterKeys(args.filters)
    const cursorByKey = parseCursor(args.paginationOpts.cursor)
    const rowsByKey = await Promise.all(
      filterKeys.map(async (filterKey) => {
        const after = cursorByKey[filterKey] ?? -1
        return await ctx.db
          .query("catalogProductIndexEntries")
          .withIndex("by_filterKey_and_sortRank", (q) =>
            q.eq("filterKey", filterKey).gt("sortRank", after),
          )
          .take(limit)
      }),
    )

    const byProduct = new Map<
      Id<"catalogProducts">,
      Doc<"catalogProductIndexEntries"> & { filterKey: string }
    >()
    for (const rows of rowsByKey) {
      for (const row of rows) {
        const current = byProduct.get(row.productId)
        if (!current || row.sortRank < current.sortRank) byProduct.set(row.productId, row)
      }
    }

    const chosen = Array.from(byProduct.values())
      .toSorted((a, b) => a.sortRank - b.sortRank)
      .slice(0, limit)

    const products = []
    const nextCursor = { ...cursorByKey }
    for (const row of chosen) {
      const product = await ctx.db.get(row.productId)
      if (product?.isVisible) {
        const variants = await ctx.db
          .query("catalogProductVariants")
          .withIndex("by_productId_and_sortRank", (q) => q.eq("productId", product._id))
          .take(250)
        products.push({ product, variants })
        nextCursor[row.filterKey] = Math.max(nextCursor[row.filterKey] ?? -1, row.sortRank)
      }
    }

    return {
      page: products,
      isDone: chosen.length < limit,
      continueCursor: chosen.length < limit ? null : serializeCursor(nextCursor),
    }
  },
})

export const listFilterGroups = query({
  args: {},
  handler: async (ctx) => {
    const colors = await ctx.db
      .query("catalogFacetOptions")
      .withIndex("by_dimension_and_sortRank", (q) => q.eq("dimension", "color"))
      .take(100)
    const categories = await ctx.db
      .query("catalogFacetOptions")
      .withIndex("by_dimension_and_sortRank", (q) => q.eq("dimension", "category"))
      .take(100)
    const collections = await ctx.db
      .query("catalogCollections")
      .withIndex("by_isVisible_and_sortRank", (q) => q.eq("isVisible", true))
      .take(250)

    return {
      colors: colors.filter((o) => o.isVisible),
      categories: categories.filter((o) => o.isVisible),
      collections,
    }
  },
})

export const listCollections = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("catalogCollections")
      .withIndex("by_isVisible_and_sortRank", (q) => q.eq("isVisible", true))
      .paginate(args.paginationOpts)
  },
})

export const generateCollectionImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

export const getCollectionPageSettingsForAdmin = query({
  args: { collectionHandle: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const collection = await ctx.db
      .query("catalogCollections")
      .withIndex("by_shopifyHandle", (q) => q.eq("shopifyHandle", args.collectionHandle))
      .unique()
    if (!collection) return null

    const settings = await ctx.db
      .query("collectionPageSettings")
      .withIndex("by_collectionHandle", (q) => q.eq("collectionHandle", args.collectionHandle))
      .unique()

    return {
      collection,
      pageSettings: settings ? await resolveCollectionPageSettings(ctx, settings) : null,
    }
  },
})

export const saveCollectionPageSettings = mutation({
  args: {
    collectionHandle: v.string(),
    heroImages: v.array(v.id("_storage")),
    specs: v.array(collectionPageSpecValidator),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    if (args.heroImages.length !== 4) {
      throw new Error("Collection pages must have exactly four images.")
    }

    const collection = await ctx.db
      .query("catalogCollections")
      .withIndex("by_shopifyHandle", (q) => q.eq("shopifyHandle", args.collectionHandle))
      .unique()
    if (!collection) throw new Error("Collection not found.")

    const specs = cleanCollectionSpecs(args.specs)
    const existing = await ctx.db
      .query("collectionPageSettings")
      .withIndex("by_collectionHandle", (q) => q.eq("collectionHandle", args.collectionHandle))
      .unique()

    const doc = {
      collectionId: collection._id,
      collectionHandle: args.collectionHandle,
      heroImages: args.heroImages,
      specs,
      updatedAt: Date.now(),
    }

    if (existing) {
      const keptIds = new Set(args.heroImages)
      for (const storageId of existing.heroImages) {
        if (!keptIds.has(storageId)) {
          try {
            await ctx.storage.delete(storageId)
          } catch {
            // already deleted / missing - ignore
          }
        }
      }
      await ctx.db.patch(existing._id, doc)
      return existing._id
    }

    return await ctx.db.insert("collectionPageSettings", doc)
  },
})

export const listCollectionsWithProductPreviews = query({
  args: {
    paginationOpts: paginationOptsValidator,
    productLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const productLimit = Math.min(Math.max(args.productLimit ?? 4, 1), 12)
    const result = await ctx.db
      .query("catalogCollections")
      .withIndex("by_isVisible_and_sortRank", (q) => q.eq("isVisible", true))
      .paginate(args.paginationOpts)

    const page = []
    for (const collection of result.page) {
      const links = await ctx.db
        .query("catalogProductCollections")
        .withIndex("by_collectionHandle_and_sortRank", (q) =>
          q.eq("collectionHandle", collection.shopifyHandle),
        )
        .take(productLimit)
      const products = []

      for (const link of links) {
        const product = await ctx.db.get(link.productId)
        if (!product?.isVisible) continue

        const variants = await ctx.db
          .query("catalogProductVariants")
          .withIndex("by_productId_and_sortRank", (q) => q.eq("productId", product._id))
          .take(1)
        const firstVariant = variants[0]

        products.push({
          _id: product._id,
          title: product.title,
          image: firstVariant?.image ?? product.image,
        })
      }

      page.push({ collection, products })
    }

    return { ...result, page }
  },
})

export const getCollection = query({
  args: { handle: v.string(), productLimit: v.number() },
  handler: async (ctx, args) => {
    const collection = await ctx.db
      .query("catalogCollections")
      .withIndex("by_shopifyHandle", (q) => q.eq("shopifyHandle", args.handle))
      .unique()
    if (!collection || !collection.isVisible) return null

    const links = await ctx.db
      .query("catalogProductCollections")
      .withIndex("by_collectionHandle_and_sortRank", (q) => q.eq("collectionHandle", args.handle))
      .take(Math.min(Math.max(args.productLimit, 1), 60))
    const products = []
    for (const link of links) {
      const product = await ctx.db.get(link.productId)
      if (product?.isVisible) products.push(product)
    }

    const settings = await ctx.db
      .query("collectionPageSettings")
      .withIndex("by_collectionHandle", (q) => q.eq("collectionHandle", args.handle))
      .unique()

    return {
      collection,
      products,
      pageSettings: settings ? await resolveCollectionPageSettings(ctx, settings) : null,
    }
  },
})

// Resolve a single visible product (with its variants) by Shopify handle. Used
// to reopen an artwork straight from a cart line or the "complete your set"
// upsell, where only the handle + image are on hand.
export const getProductByHandle = query({
  args: { handle: v.string() },
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("catalogProducts")
      .withIndex("by_shopifyHandle", (q) => q.eq("shopifyHandle", args.handle))
      .unique()
    if (!product || !product.isVisible) return null

    const variants = await ctx.db
      .query("catalogProductVariants")
      .withIndex("by_productId_and_sortRank", (q) => q.eq("productId", product._id))
      .take(250)

    return { product, variants }
  },
})

export const upsertSyncedProducts = internalMutation({
  args: { products: v.array(syncedProductValidator), syncedAt: v.number() },
  handler: async (ctx, args) => {
    let productCount = 0
    let collectionCount = 0

    for (const incoming of args.products) {
      const existingProduct = await ctx.db
        .query("catalogProducts")
        .withIndex("by_shopifyProductId", (q) =>
          q.eq("shopifyProductId", incoming.shopifyProductId),
        )
        .unique()

      const primary =
        incoming.collections.find((c) => c.shopifyHandle === incoming.primaryCollectionHandle) ??
        incoming.collections[0]

      const productDoc = {
        shopifyProductId: incoming.shopifyProductId,
        shopifyHandle: incoming.shopifyHandle,
        title: incoming.title,
        description: incoming.description,
        image: incoming.image,
        images: incoming.images.slice(0, 10),
        priceMin: incoming.priceMin,
        priceMax: incoming.priceMax,
        currencyCode: incoming.currencyCode,
        firstAvailableVariantId: incoming.firstAvailableVariantId,
        availableForSale: incoming.availableForSale,
        colorKey: incoming.colorKey,
        colorLabel: incoming.colorLabel,
        categoryKey: incoming.categoryKey,
        categoryLabel: incoming.categoryLabel,
        primaryCollectionHandle: primary?.shopifyHandle,
        primaryCollectionTitle: primary?.title,
        sortRank: incoming.sortRank,
        isVisible: incoming.isVisible,
        shopifyUpdatedAt: incoming.shopifyUpdatedAt,
        syncedAt: args.syncedAt,
      }

      const productId = existingProduct
        ? (await ctx.db.patch(existingProduct._id, productDoc), existingProduct._id)
        : await ctx.db.insert("catalogProducts", productDoc)

      await deleteByProductId(ctx, "catalogProductCollections", productId)
      await deleteByProductId(ctx, "catalogProductIndexEntries", productId)
      await deleteByProductId(ctx, "catalogProductVariants", productId)

      for (const variant of incoming.variants) {
        await ctx.db.insert("catalogProductVariants", {
          productId,
          shopifyProductId: incoming.shopifyProductId,
          shopifyVariantId: variant.shopifyVariantId,
          title: variant.title,
          sku: variant.sku,
          artworkKey: variant.artworkKey,
          artworkLabel: variant.artworkLabel,
          sizeKey: variant.sizeKey,
          sizeLabel: variant.sizeLabel,
          frameKey: variant.frameKey,
          frameLabel: variant.frameLabel,
          image: variant.image,
          price: variant.price,
          currencyCode: variant.currencyCode,
          availableForSale: variant.availableForSale,
          sortRank: variant.sortRank,
          syncedAt: args.syncedAt,
        })
      }

      for (const collection of incoming.collections) {
        const existingCollection = await ctx.db
          .query("catalogCollections")
          .withIndex("by_shopifyCollectionId", (q) =>
            q.eq("shopifyCollectionId", collection.shopifyCollectionId),
          )
          .unique()
        const collectionDoc = {
          ...collection,
          syncedAt: args.syncedAt,
        }
        const collectionId = existingCollection
          ? (await ctx.db.patch(existingCollection._id, collectionDoc), existingCollection._id)
          : await ctx.db.insert("catalogCollections", collectionDoc)

        await ctx.db.insert("catalogProductCollections", {
          productId,
          collectionId,
          collectionHandle: collection.shopifyHandle,
          sortRank: incoming.sortRank,
          syncedAt: args.syncedAt,
        })
        collectionCount++
      }

      await upsertFacetOption(ctx, "color", incoming.colorKey, incoming.colorLabel, args.syncedAt)
      await upsertFacetOption(
        ctx,
        "category",
        incoming.categoryKey,
        incoming.categoryLabel,
        args.syncedAt,
      )

      for (const filterKey of buildProductFilterKeys(incoming)) {
        await ctx.db.insert("catalogProductIndexEntries", {
          filterKey,
          productId,
          sortRank: incoming.sortRank,
          syncedAt: args.syncedAt,
        })
      }

      productCount++
    }

    return { productCount, collectionCount }
  },
})

export const finalizeCatalogSyncBatch = internalMutation({
  args: {
    syncedAt: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 200)
    let hiddenProductCount = 0
    let hiddenCollectionCount = 0
    let hiddenFacetOptionCount = 0

    const staleProducts = await ctx.db
      .query("catalogProducts")
      .withIndex("by_syncedAt", (q) => q.lt("syncedAt", args.syncedAt))
      .take(limit + 1)

    for (const product of staleProducts.slice(0, limit)) {
      if (product.isVisible || product.availableForSale) hiddenProductCount++
      await ctx.db.patch(product._id, {
        isVisible: false,
        availableForSale: false,
        syncedAt: args.syncedAt,
      })
      await deleteByProductId(ctx, "catalogProductCollections", product._id)
      await deleteByProductId(ctx, "catalogProductIndexEntries", product._id)
      await markVariantsUnavailable(ctx, product._id, args.syncedAt)
    }

    const staleCollections = await ctx.db
      .query("catalogCollections")
      .withIndex("by_syncedAt", (q) => q.lt("syncedAt", args.syncedAt))
      .take(limit + 1)

    for (const collection of staleCollections.slice(0, limit)) {
      if (collection.isVisible) hiddenCollectionCount++
      await ctx.db.patch(collection._id, { isVisible: false, syncedAt: args.syncedAt })
    }

    const staleFacetOptions = await ctx.db
      .query("catalogFacetOptions")
      .withIndex("by_syncedAt", (q) => q.lt("syncedAt", args.syncedAt))
      .take(limit + 1)

    for (const option of staleFacetOptions.slice(0, limit)) {
      if (option.isVisible) hiddenFacetOptionCount++
      await ctx.db.patch(option._id, { isVisible: false, syncedAt: args.syncedAt })
    }

    return {
      hiddenProductCount,
      hiddenCollectionCount,
      hiddenFacetOptionCount,
      hasMore:
        staleProducts.length > limit ||
        staleCollections.length > limit ||
        staleFacetOptions.length > limit,
    }
  },
})
