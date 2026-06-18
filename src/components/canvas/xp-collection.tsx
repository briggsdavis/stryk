import { forwardRef, useEffect, useRef } from "react"
import type { ActiveFilters } from "../../lib/filters"
import { productMatches } from "../../lib/filters"
import { gsap } from "../../lib/gsap"
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
  const firstFilterRunRef = useRef(true)

  // ── Filter transition ──────────────────────────────────────────────────────
  // Pieces stay in the layout (no reflow / shifting). Matching pieces blur in;
  // the rest blur and fade out. The canvas entrance owns the very first reveal,
  // so skip that pass here.
  useEffect(() => {
    if (firstFilterRunRef.current) {
      firstFilterRunRef.current = false
      return
    }

    const matched: HTMLElement[] = []
    products.forEach((p) => {
      const el = itemRefs.current.get(p.id)
      if (!el) return
      const isMatch = productMatches(p, filters)
      el.dataset.filtered = isMatch ? "false" : "true"
      el.style.pointerEvents = isMatch ? "" : "none"
      if (isMatch) {
        matched.push(el)
      } else {
        gsap.to(el, {
          opacity: 0,
          scale: 0.92,
          filter: "blur(8px)",
          duration: 0.45,
          ease: "power2.out",
          overwrite: "auto",
        })
      }
    })

    gsap.fromTo(
      matched,
      { opacity: 0, scale: 0.96, filter: "blur(12px)" },
      {
        opacity: 1,
        scale: 1,
        filter: "blur(0px)",
        duration: 0.7,
        ease: "power2.out",
        stagger: { each: 0.025, from: "random" },
        overwrite: "auto",
      },
    )
  }, [filters, products, itemRefs])

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
