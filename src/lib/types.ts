export type ProductCategory = "hotel" | "misc" | "restaurant" | "empties"

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
}

export interface Collection {
  slug: string
  name: string
  color: string
  products: Product[]
}

export type ViewMode = "xp" | "grid"
export type ZoomLevel = 1 | 2
