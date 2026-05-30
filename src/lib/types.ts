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
export type ZoomLevel = 0 | 1 | 2
