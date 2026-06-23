import type { Product } from "./types"

// The three dimensions a canvas product can be filtered by.
export type FilterKey = "color" | "category" | "collection"

export interface ActiveFilters {
  color: string[]
  category: string[]
  collection: string[]
}

export const EMPTY_FILTERS: ActiveFilters = { color: [], category: [], collection: [] }

// Swatch colours used to render the colour-filter dots.
export const COLOR_SWATCHES: Record<string, string> = {
  Black: "#222222",
  Cream: "#e8dcc8",
  Green: "#506157",
  Blue: "#4a699f",
  Terracotta: "#b5836a",
  Grey: "#a1a19c",
}

export interface FilterOption {
  value: string
  label: string
  swatch?: string
}

export interface FilterGroup {
  key: FilterKey
  label: string
  options: FilterOption[]
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

// Derive the available filter options straight from the product set so the UI
// always reflects the real data. Option labels are rendered lowercase.
export function buildFilterGroups(products: Product[]): FilterGroup[] {
  const colors = unique(products.map((p) => p.colorName))
  const categories = unique(products.map((p) => p.category))

  const collectionMap = new Map<string, string>()
  products.forEach((p) => collectionMap.set(p.collectionSlug, p.collectionName))

  return [
    {
      key: "color",
      label: "color",
      options: colors.map((c) => ({ value: c, label: c.toLowerCase(), swatch: COLOR_SWATCHES[c] })),
    },
    {
      key: "category",
      label: "category",
      options: categories.map((c) => ({ value: c, label: c.toLowerCase() })),
    },
    {
      key: "collection",
      label: "collection",
      options: Array.from(collectionMap, ([value, label]) => ({
        value,
        label: label.toLowerCase(),
      })),
    },
  ]
}

// A product matches when, for every dimension with active selections, its value
// is among the selected ones (AND across dimensions, OR within a dimension).
export function productMatches(product: Product, filters: ActiveFilters): boolean {
  return (
    (filters.color.length === 0 || filters.color.includes(product.colorName)) &&
    (filters.category.length === 0 || filters.category.includes(product.category)) &&
    (filters.collection.length === 0 || filters.collection.includes(product.collectionSlug))
  )
}

export function activeFilterCount(filters: ActiveFilters): number {
  return filters.color.length + filters.category.length + filters.collection.length
}
