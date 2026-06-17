import { forwardRef } from "react"
import type { ActiveFilters } from "../../lib/filters"
import { productMatches } from "../../lib/filters"
import type { Product } from "../../lib/types"
import { XpProductItem } from "./xp-product-item"

interface XpCollectionProps {
  products: Product[]
  onItemClick: (product: Product, el: HTMLElement) => void
  itemRefs: React.MutableRefObject<Map<string, HTMLElement>>
  filters: ActiveFilters
}

const COL_COUNT = 6
const COL_OFFSETS = ["6vw", "18vw", "2vw", "14vw", "8vw", "20vw"]

function buildColumns(products: Product[]): Product[][] {
  const cols: Product[][] = Array.from({ length: COL_COUNT }, () => [])
  products.forEach((p, i) => cols[i % COL_COUNT].push(p))
  return cols
}

export const XpCollection = forwardRef<HTMLDivElement, XpCollectionProps>(function XpCollection(
  { products, onItemClick, itemRefs, filters },
  ref,
) {
  const columns = buildColumns(products)
  let globalIndex = 0

  return (
    <div ref={ref} className="xp-collection">
      {columns.map((col, ci) => (
        <div
          key={ci}
          className="xp-column"
          style={{
            marginTop: COL_OFFSETS[ci],
            marginRight: ci < columns.length - 1 ? "12vw" : 0,
          }}
        >
          {col.map((product) => {
            const idx = globalIndex++
            return (
              <XpProductItem
                key={product.id}
                product={product}
                index={idx}
                onClick={onItemClick}
                hidden={!productMatches(product, filters)}
                itemRef={(el) => {
                  if (el) itemRefs.current.set(product.id, el)
                  else itemRefs.current.delete(product.id)
                }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
})
