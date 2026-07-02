/* eslint-disable no-await-in-loop */
import { v } from "convex/values"
import { api, internal } from "./_generated/api"
import { action, env, query } from "./_generated/server"
import type { ActionCtx } from "./_generated/server"

type ShopifyImage = {
  url: string
  altText?: string | null
  width?: number | null
  height?: number | null
}

type ShopifyMediaNode = {
  image?: ShopifyImage | null
}

type ShopifyVariant = {
  id: string
  title: string
  sku?: string | null
  price?: string | null
  selectedOptions: Array<{ name: string; value: string }>
  image?: ShopifyImage | null
}

type ShopifyMetafield = {
  key: string
  value: string
  type: string
} | null

type ShopifyCollection = {
  id: string
  handle: string
  title: string
  description?: string | null
  updatedAt?: string | null
  image?: ShopifyImage | null
}

type ShopifyProduct = {
  id: string
  handle: string
  title: string
  description?: string | null
  status: string
  publishedAt?: string | null
  updatedAt?: string | null
  media: { nodes: ShopifyMediaNode[] }
  variants: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
    nodes: ShopifyVariant[]
  }
  strykColor?: ShopifyMetafield
  color?: ShopifyMetafield
  strykCategory?: ShopifyMetafield
  category?: ShopifyMetafield
  primaryCollectionHandle?: ShopifyMetafield
  collections: { nodes: ShopifyCollection[] }
}

type ShopifyProductsResponse = {
  data?: {
    products: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
      nodes: ShopifyProduct[]
    }
  }
  errors?: Array<{ message: string }>
}

type ShopifyTokenResponse = {
  access_token?: string
  error?: string
  error_description?: string
}

type ShopifyProductVariantsResponse = {
  data?: {
    product?: {
      variants: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null }
        nodes: ShopifyVariant[]
      }
    } | null
  }
  errors?: Array<{ message: string }>
}

type SyncCatalogPageArgs = {
  after?: string
  first?: number
  syncStartedAt?: number
}

const PRODUCTS_QUERY = `
  query StrykCatalogProducts($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: UPDATED_AT, reverse: true) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        handle
        title
        description
        status
        publishedAt
        updatedAt
        media(first: 10) {
          nodes {
            ... on MediaImage {
              image {
                url
                altText
                width
                height
              }
            }
          }
        }
        variants(first: 250) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            title
            sku
            price
            selectedOptions {
              name
              value
            }
            image {
              url
              altText
              width
              height
            }
          }
        }
        strykColor: metafield(namespace: "custom", key: "stryk_color") {
          key
          value
          type
        }
        color: metafield(namespace: "custom", key: "color") {
          key
          value
          type
        }
        strykCategory: metafield(namespace: "custom", key: "stryk_category") {
          key
          value
          type
        }
        category: metafield(namespace: "custom", key: "category") {
          key
          value
          type
        }
        primaryCollectionHandle: metafield(namespace: "custom", key: "primary_collection_handle") {
          key
          value
          type
        }
        collections(first: 20) {
          nodes {
            id
            handle
            title
            description
            updatedAt
            image {
              url
              altText
              width
              height
            }
          }
        }
      }
    }
  }
`

const PRODUCT_VARIANTS_QUERY = `
  query StrykProductVariants($id: ID!, $first: Int!, $after: String) {
    product(id: $id) {
      variants(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          title
          sku
          price
          selectedOptions {
            name
            value
          }
          image {
            url
            altText
            width
            height
          }
        }
      }
    }
  }
`

const SORT_RANK_BASE = 9_999_999_999_999

function requiredEnv(name: string, value: string | undefined) {
  if (!value) throw new Error(`Missing Convex env var: ${name}`)
  return value
}

async function getAdminAccessToken(storeDomain: string, clientId: string, clientSecret: string) {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  })

  const response = await fetch(`https://${storeDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  const payload = (await response.json()) as ShopifyTokenResponse

  if (!response.ok || !payload.access_token) {
    const message = payload.error_description ?? payload.error ?? `HTTP ${response.status}`
    throw new Error(`Could not get Shopify Admin access token: ${message}`)
  }

  return payload.access_token
}

async function shopifyGraphql<T>(
  storeDomain: string,
  apiVersion: string,
  accessToken: string,
  graphqlQuery: string,
  variables: Record<string, unknown>,
) {
  const response = await fetch(`https://${storeDomain}/admin/api/${apiVersion}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query: graphqlQuery, variables }),
  })

  if (!response.ok) {
    throw new Error(`Shopify Admin API request failed: ${response.status}`)
  }

  const payload = (await response.json()) as T & { errors?: Array<{ message: string }> }
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "))
  }
  return payload
}

function normalizeKey(value: string | undefined) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function titleCase(value: string | undefined) {
  if (!value) return undefined
  return value
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

function metafieldValue(product: ShopifyProduct, keys: string[]) {
  const byKey: Record<string, ShopifyMetafield | undefined> = {
    stryk_color: product.strykColor,
    color: product.color,
    stryk_category: product.strykCategory,
    category: product.category,
    primary_collection_handle: product.primaryCollectionHandle,
  }
  return keys.map((key) => byKey[key]).find((metafield) => metafield)?.value
}

function isString(value: string | undefined): value is string {
  return typeof value === "string"
}

function variantPrices(variants: ShopifyVariant[]) {
  const prices = variants
    .map((variant) => Number.parseFloat(variant.price ?? ""))
    .filter((price) => Number.isFinite(price))
  if (prices.length === 0) return { min: 0, max: 0 }
  return { min: Math.min(...prices), max: Math.max(...prices) }
}

function optionValue(variant: ShopifyVariant, name: string) {
  return variant.selectedOptions.find((option) => option.name.toLowerCase() === name)?.value
}

function isPublishedProduct(product: ShopifyProduct) {
  // Catalog availability only. Cart/checkout should validate the selected variant
  // against Shopify Storefront availability when the customer adds it to cart.
  return product.status === "ACTIVE" && !!product.publishedAt
}

function normalizeVariant(variant: ShopifyVariant, product: ShopifyProduct, index: number) {
  const artworkRaw = optionValue(variant, "artwork")
  const sizeRaw = optionValue(variant, "size")
  const frameRaw = optionValue(variant, "frame")
  const price = Number.parseFloat(variant.price ?? "")

  return {
    shopifyVariantId: variant.id,
    title: variant.title,
    sku: variant.sku ?? undefined,
    artworkKey: normalizeKey(artworkRaw),
    artworkLabel: artworkRaw,
    sizeKey: normalizeKey(sizeRaw),
    sizeLabel: sizeRaw,
    frameKey: normalizeKey(frameRaw),
    frameLabel: frameRaw,
    image: variant.image?.url,
    price: Number.isFinite(price) ? price : 0,
    currencyCode: "USD",
    availableForSale: isPublishedProduct(product),
    sortRank: index,
  }
}

function normalizeProduct(product: ShopifyProduct) {
  const variantImages = product.variants.nodes.map((variant) => variant.image?.url).filter(isString)
  const productImages = product.media.nodes.map((node) => node.image?.url).filter(isString)
  const images = Array.from(new Set([...productImages, ...variantImages]))
  const colorRaw = metafieldValue(product, ["stryk_color", "color"])
  const categoryRaw = metafieldValue(product, ["stryk_category", "category"])
  const primaryCollectionHandle = normalizeKey(
    metafieldValue(product, ["primary_collection_handle"]),
  )
  const colorKey = normalizeKey(colorRaw)
  const categoryKey = normalizeKey(categoryRaw)
  const prices = variantPrices(product.variants.nodes)
  const firstAvailableVariant = product.variants.nodes[0]
  const updatedAtMs = Date.parse(product.updatedAt ?? "")

  return {
    shopifyProductId: product.id,
    shopifyHandle: product.handle,
    title: product.title,
    description: product.description ?? undefined,
    image: images[0] ?? "",
    images: images.slice(0, 20),
    priceMin: prices.min,
    priceMax: prices.max,
    currencyCode: "USD",
    firstAvailableVariantId: firstAvailableVariant?.id,
    availableForSale: isPublishedProduct(product),
    colorKey,
    colorLabel: titleCase(colorRaw),
    categoryKey,
    categoryLabel: titleCase(categoryRaw),
    primaryCollectionHandle,
    primaryCollectionTitle: product.collections.nodes.find(
      (collection) => collection.handle === primaryCollectionHandle,
    )?.title,
    sortRank: Number.isFinite(updatedAtMs) ? SORT_RANK_BASE - updatedAtMs : SORT_RANK_BASE,
    isVisible: isPublishedProduct(product),
    shopifyUpdatedAt: product.updatedAt ?? undefined,
    variants: product.variants.nodes.map((variant, index) =>
      normalizeVariant(variant, product, index),
    ),
    collections: product.collections.nodes.map((collection) => ({
      shopifyCollectionId: collection.id,
      shopifyHandle: collection.handle,
      title: collection.title,
      description: collection.description ?? undefined,
      image: collection.image?.url,
      sortRank: collection.title.toLowerCase().charCodeAt(0),
      isVisible: true,
      shopifyUpdatedAt: collection.updatedAt ?? undefined,
    })),
  }
}

async function fetchAllProductVariants(
  storeDomain: string,
  apiVersion: string,
  accessToken: string,
  product: ShopifyProduct,
): Promise<ShopifyProduct> {
  const variants = [...product.variants.nodes]
  let hasNextPage = product.variants.pageInfo.hasNextPage
  let after = product.variants.pageInfo.endCursor

  while (hasNextPage) {
    const payload = await shopifyGraphql<ShopifyProductVariantsResponse>(
      storeDomain,
      apiVersion,
      accessToken,
      PRODUCT_VARIANTS_QUERY,
      { id: product.id, first: 250, after },
    )
    const connection = payload.data?.product?.variants
    if (!connection) break
    variants.push(...connection.nodes)
    hasNextPage = connection.pageInfo.hasNextPage
    after = connection.pageInfo.endCursor
  }

  return {
    ...product,
    variants: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: variants },
  }
}

async function syncCatalogPageFromShopify(ctx: ActionCtx, args: SyncCatalogPageArgs) {
  const storeDomain = requiredEnv("SHOPIFY_STORE_DOMAIN", env.SHOPIFY_STORE_DOMAIN)
  const clientId = requiredEnv("SHOPIFY_CLIENT_ID", env.SHOPIFY_CLIENT_ID)
  const clientSecret = requiredEnv("SHOPIFY_CLIENT_SECRET", env.SHOPIFY_CLIENT_SECRET)
  const apiVersion = env.SHOPIFY_API_VERSION ?? "2026-04"
  const first = Math.min(Math.max(args.first ?? 25, 1), 50)
  const syncStartedAt = args.syncStartedAt ?? Date.now()
  const accessToken = await getAdminAccessToken(storeDomain, clientId, clientSecret)

  const payload = await shopifyGraphql<ShopifyProductsResponse>(
    storeDomain,
    apiVersion,
    accessToken,
    PRODUCTS_QUERY,
    {
      first,
      after: args.after ?? null,
    },
  )

  const productsConnection = payload.data?.products
  if (!productsConnection) throw new Error("Shopify response did not include products")

  const products: Array<ReturnType<typeof normalizeProduct>> = []
  for (const product of productsConnection.nodes) {
    const hydrated = await fetchAllProductVariants(storeDomain, apiVersion, accessToken, product)
    products.push(normalizeProduct(hydrated))
  }
  const result: { productCount: number; collectionCount: number } = await ctx.runMutation(
    internal.catalog.upsertSyncedProducts,
    { products, syncedAt: syncStartedAt },
  )

  return {
    ...result,
    syncStartedAt,
    hasNextPage: productsConnection.pageInfo.hasNextPage,
    nextCursor: productsConnection.pageInfo.endCursor,
  }
}

async function finalizeCatalogSync(ctx: ActionCtx, syncStartedAt: number) {
  const totals = {
    hiddenProductCount: 0,
    hiddenCollectionCount: 0,
    hiddenFacetOptionCount: 0,
  }
  let hasMore = true
  let batchCount = 0

  while (hasMore && batchCount < 50) {
    const batch: typeof totals & { hasMore: boolean } = await ctx.runMutation(
      internal.catalog.finalizeCatalogSyncBatch,
      { syncedAt: syncStartedAt, limit: 100 },
    )
    totals.hiddenProductCount += batch.hiddenProductCount
    totals.hiddenCollectionCount += batch.hiddenCollectionCount
    totals.hiddenFacetOptionCount += batch.hiddenFacetOptionCount
    hasMore = batch.hasMore
    batchCount++
  }

  if (hasMore) {
    throw new Error(
      "Catalog cleanup did not finish. Run sync again to continue pruning stale rows.",
    )
  }

  return totals
}

export const syncCatalogPage = action({
  args: {
    after: v.optional(v.string()),
    first: v.optional(v.number()),
    syncStartedAt: v.optional(v.number()),
    syncSecret: v.string(),
  },
  handler: async (ctx, args) => {
    const syncSecret = requiredEnv("SHOPIFY_SYNC_SECRET", env.SHOPIFY_SYNC_SECRET)
    if (args.syncSecret !== syncSecret) throw new Error("Invalid Shopify sync secret")

    return await syncCatalogPageFromShopify(ctx, args)
  },
})

export const syncCatalogPageForAdmin = action({
  args: {
    after: v.optional(v.string()),
    first: v.optional(v.number()),
    syncStartedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const viewer: { email: string } | null = await ctx.runQuery(api.admin.viewer, {})
    if (!viewer) throw new Error("Unauthorized")

    return await syncCatalogPageFromShopify(ctx, args)
  },
})

export const finalizeCatalogSyncForAdmin = action({
  args: {
    syncStartedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const viewer: { email: string } | null = await ctx.runQuery(api.admin.viewer, {})
    if (!viewer) throw new Error("Unauthorized")

    return await finalizeCatalogSync(ctx, args.syncStartedAt)
  },
})

export const finalizeCatalogSyncWithSecret = action({
  args: {
    syncStartedAt: v.number(),
    syncSecret: v.string(),
  },
  handler: async (ctx, args) => {
    const syncSecret = requiredEnv("SHOPIFY_SYNC_SECRET", env.SHOPIFY_SYNC_SECRET)
    if (args.syncSecret !== syncSecret) throw new Error("Invalid Shopify sync secret")

    return await finalizeCatalogSync(ctx, args.syncStartedAt)
  },
})

export const storefrontConfig = query({
  args: {},
  handler: () => {
    const publicAccessToken =
      env.SHOPIFY_STOREFRONT_PUBLIC_ACCESS_TOKEN ?? env.SHOPIFY_STOREFRONT_ACCESS_TOKEN
    const storeDomain = env.SHOPIFY_STORE_DOMAIN

    return {
      isConfigured: !!storeDomain && !!publicAccessToken,
      storeDomain: storeDomain ?? "",
      apiVersion: env.SHOPIFY_API_VERSION ?? "2026-04",
      publicAccessToken: publicAccessToken ?? "",
    }
  },
})
