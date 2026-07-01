import type { Doc } from "../../convex/_generated/dataModel"
import type { ActiveFilters, FilterGroup } from "./filters"
import { capitalizeFirstLetter, COLOR_SWATCHES } from "./filters"
import type { Product } from "./types"

export type CatalogProduct = Doc<"catalogProducts">
export type CatalogProductVariant = Doc<"catalogProductVariants">
export type CatalogCollection = Doc<"catalogCollections">
export type CatalogFacetOption = Doc<"catalogFacetOptions">
export type CatalogProductResult = {
  product: CatalogProduct
  variants: CatalogProductVariant[]
}

function labelFromKey(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ")
}

function isString(value: string | undefined): value is string {
  return typeof value === "string"
}

export function catalogProductToProduct(
  result: CatalogProduct | CatalogProductResult,
  filters?: ActiveFilters,
): Product {
  const product = "product" in result ? result.product : result
  const variants = "variants" in result ? result.variants : []
  const colorName = product.colorKey ?? product.colorLabel ?? "unknown"
  const colorLabel = product.colorLabel ?? labelFromKey(colorName)
  const collectionSlug = filters?.collection[0] ?? product.primaryCollectionHandle ?? "catalog"
  const collectionName = product.primaryCollectionTitle ?? "Catalog"
  const variantImages = variants.map((variant) => variant.image).filter(isString)
  const images = Array.from(new Set([product.image, ...product.images, ...variantImages]))

  return {
    id: product._id,
    slug: product.shopifyHandle,
    name: product.title,
    description: product.description,
    collectionName,
    collectionSlug,
    image: product.image,
    images: images.length > 0 ? images : [product.image],
    price: product.priceMin,
    color: COLOR_SWATCHES[colorLabel] ?? "#635858",
    colorName,
    category: product.categoryKey ?? "misc",
    available: product.availableForSale,
    variants: variants.map((variant) => ({
      id: variant._id,
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
    })),
  }
}

export function catalogFiltersToGroups(input: {
  colors: CatalogFacetOption[]
  categories: CatalogFacetOption[]
  collections: CatalogCollection[]
}): FilterGroup[] {
  return [
    {
      key: "color",
      label: "color",
      options: input.colors.map((option) => ({
        value: option.value,
        label: option.label[0]?.toUpperCase() + option.label.slice(1).toLowerCase(),
        swatch: option.swatch ?? COLOR_SWATCHES[option.label],
      })),
    },
    {
      key: "category",
      label: "category",
      options: input.categories.map((option) => ({
        value: option.value,
        label: capitalizeFirstLetter(option.label),
      })),
    },
    {
      key: "collection",
      label: "collection",
      options: input.collections.map((collection) => ({
        value: collection.shopifyHandle,
        label: capitalizeFirstLetter(collection.title),
      })),
    },
  ]
}
