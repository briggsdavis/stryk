import { defineApp } from "convex/server"
import { v } from "convex/values"

const app = defineApp({
  env: {
    SHOPIFY_STORE_DOMAIN: v.optional(v.string()),
    SHOPIFY_CLIENT_ID: v.optional(v.string()),
    SHOPIFY_CLIENT_SECRET: v.optional(v.string()),
    SHOPIFY_API_VERSION: v.optional(v.string()),
    SHOPIFY_SYNC_SECRET: v.optional(v.string()),
    SHOPIFY_STOREFRONT_PUBLIC_ACCESS_TOKEN: v.optional(v.string()),
    SHOPIFY_STOREFRONT_ACCESS_TOKEN: v.optional(v.string()),
  },
})

export default app
