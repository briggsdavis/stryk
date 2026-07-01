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
  White: "#f7f5ef",
  Gray: "#9a9a9a",
  Brown: "#6f4e37",
  Beige: "#d8c3a5",
  Ivory: "#fff8e7",
  Red: "#c23b3b",
  Orange: "#d97832",
  Yellow: "#e7c84b",
  Green: "#4f7f52",
  Blue: "#3f6ea8",
  Purple: "#7b5aa6",
  Pink: "#d989a5",
  Navy: "#263f63",
  Teal: "#347f7a",
  Turquoise: "#48aeb2",
  Olive: "#707845",
  Mint: "#9bc7aa",
  Gold: "#c9a23a",
  Silver: "#c4c6c8",
  Burgundy: "#7a2f3f",
  Tan: "#c9a16d",
  Coral: "#d96f5f",
  Lavender: "#a995c9",
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

export function capitalizeFirstLetter(value: string) {
  const label = value.toLowerCase()
  return label[0]?.toUpperCase() + label.slice(1)
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

// Derive the available filter options straight from the product set so the UI
// always reflects the real data. Option labels are display-formatted only.
export function buildFilterGroups(products: Product[]): FilterGroup[] {
  const colors = unique(products.map((p) => p.colorName))
  const categories = unique(products.map((p) => p.category))

  const collectionMap = new Map<string, string>()
  products.forEach((p) => collectionMap.set(p.collectionSlug, p.collectionName))

  return [
    {
      key: "color",
      label: "color",
      options: colors.map((c) => ({
        value: c,
        label: c[0]?.toUpperCase() + c.slice(1).toLowerCase(),
        swatch: COLOR_SWATCHES[c],
      })),
    },
    {
      key: "category",
      label: "category",
      options: categories.map((c) => ({ value: c, label: capitalizeFirstLetter(c) })),
    },
    {
      key: "collection",
      label: "collection",
      options: Array.from(collectionMap, ([value, label]) => ({
        value,
        label: capitalizeFirstLetter(label),
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
