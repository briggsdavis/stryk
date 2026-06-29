export type ProductCategory = string

export interface ProductVariant {
  id: string
  shopifyVariantId: string
  title: string
  sku?: string
  artworkKey?: string
  artworkLabel?: string
  sizeKey?: string
  sizeLabel?: string
  frameKey?: string
  frameLabel?: string
  image?: string
  price: number
  currencyCode: string
  availableForSale: boolean
}

export interface Product {
  id: string
  slug: string
  name: string
  description?: string
  collectionName: string
  collectionSlug: string
  image: string
  images?: string[]
  hoverImage?: string
  price: number
  color: string
  // Named colour bucket used by the canvas colour filter (e.g. "Green").
  colorName: string
  // Piece category used by the canvas category filter.
  category: ProductCategory
  size?: string
  available: boolean
  variants?: ProductVariant[]
}

export interface Collection {
  slug: string
  name: string
  color: string
  products: Product[]
}

export type ViewMode = "xp" | "grid"
// 2 = default, 1 = zoomed out, 0 = zoomed out further (for large collections).
export type ZoomLevel = 0 | 1 | 2
