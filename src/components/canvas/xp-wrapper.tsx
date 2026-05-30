import { forwardRef } from "react"
import type { Product } from "../../lib/types"
import { XpCollection } from "./xp-collection"

interface XpWrapperProps {
  products: Product[]
  onItemClick: (product: Product, el: HTMLElement) => void
  collectionRef: React.RefObject<HTMLDivElement | null>
  itemRefs: React.MutableRefObject<Map<string, HTMLElement>>
  visible: boolean
}

export const XpWrapper = forwardRef<HTMLDivElement, XpWrapperProps>(function XpWrapper(
  { products, onItemClick, collectionRef, itemRefs },
  ref,
) {
  // Always rendered so GSAP refs stay alive; visibility controlled by parent opacity
  return (
    <div
      ref={ref}
      className="xp-wrapper"
      style={{ width: "100vw", height: "100vh" }}
    >
      <XpCollection
        ref={collectionRef}
        products={products}
        onItemClick={onItemClick}
        itemRefs={itemRefs}
      />
    </div>
  )
})
