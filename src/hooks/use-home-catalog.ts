import { useQuery } from "convex/react"
import { useMemo } from "react"
import { api } from "../../convex/_generated/api"
import { catalogFiltersToGroups, catalogProductToProduct } from "../lib/catalog"
import type { ActiveFilters } from "../lib/filters"

export function useHomeCatalog(filters: ActiveFilters) {
  const liveProducts = useQuery(api.catalog.listProducts, {
    filters,
    paginationOpts: { numItems: 120, cursor: null },
  })
  const liveFilterOptions = useQuery(api.catalog.listFilterGroups)

  return useMemo(() => {
    if (!liveProducts || !liveFilterOptions) {
      return {
        products: [],
        filterGroups: [],
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
