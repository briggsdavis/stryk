import { forwardRef } from "react"
import type { ActiveFilters } from "../../lib/filters"
import type { Product } from "../../lib/types"
import { XpCollection } from "./xp-collection"

interface XpWrapperProps {
  products: Product[]
  onItemClick: (product: Product, el: HTMLElement) => void
  collectionRef: React.RefObject<HTMLDivElement | null>
  itemRefs: React.MutableRefObject<Map<string, HTMLElement>>
  visible: boolean
  filters: ActiveFilters
  onLayoutChange?: () => void
}

export const XpWrapper = forwardRef<HTMLDivElement, XpWrapperProps>(function XpWrapper(
  { products, onItemClick, collectionRef, itemRefs, filters, onLayoutChange },
  ref,
) {
  // Always rendered so GSAP refs stay alive; visibility controlled by parent opacity
  return (
    <div ref={ref} className="xp-wrapper" style={{ width: "100%", height: "100%" }}>
      <XpCollection
        ref={collectionRef}
        products={products}
        onItemClick={onItemClick}
        itemRefs={itemRefs}
        filters={filters}
        onLayoutChange={onLayoutChange}
      />
    </div>
  )
})
