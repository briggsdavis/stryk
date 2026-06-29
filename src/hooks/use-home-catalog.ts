import { useQuery } from "convex/react"
import { useMemo } from "react"
import { api } from "../../convex/_generated/api"
import { catalogFiltersToGroups, catalogProductToProduct } from "../lib/catalog"
import { DEMO_PRODUCTS } from "../lib/demo-data"
import type { ActiveFilters } from "../lib/filters"
import { buildFilterGroups } from "../lib/filters"

const DEMO_FILTER_GROUPS = buildFilterGroups(DEMO_PRODUCTS)

export function useHomeCatalog(filters: ActiveFilters) {
  const liveProducts = useQuery(api.catalog.listProducts, {
    filters,
    paginationOpts: { numItems: 120, cursor: null },
  })
  const liveFilterOptions = useQuery(api.catalog.listFilterGroups)

  return useMemo(() => {
    if (!liveProducts || !liveFilterOptions) {
      return {
        products: DEMO_PRODUCTS,
        filterGroups: DEMO_FILTER_GROUPS,
        isLive: false,
      }
    }

    const hasLiveCatalog =
      liveProducts.page.length > 0 ||
      liveFilterOptions.colors.length > 0 ||
      liveFilterOptions.categories.length > 0 ||
      liveFilterOptions.collections.length > 0

    if (!hasLiveCatalog) {
      return {
        products: DEMO_PRODUCTS,
        filterGroups: DEMO_FILTER_GROUPS,
        isLive: false,
      }
    }

    return {
      products: liveProducts.page.map((product) => catalogProductToProduct(product, filters)),
      filterGroups: catalogFiltersToGroups(liveFilterOptions),
      isLive: true,
    }
  }, [filters, liveProducts, liveFilterOptions])
}
