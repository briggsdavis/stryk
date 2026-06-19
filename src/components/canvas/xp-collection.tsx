import { forwardRef, useLayoutEffect, useMemo, useRef } from "react"
import type { ActiveFilters } from "../../lib/filters"
import { activeFilterCount, productMatches } from "../../lib/filters"
import { Flip, gsap } from "../../lib/gsap"
import type { Product } from "../../lib/types"
import { XpProductItem } from "./xp-product-item"

interface XpCollectionProps {
  products: Product[]
  onItemClick: (product: Product, el: HTMLElement) => void
  itemRefs: React.MutableRefObject<Map<string, HTMLElement>>
  filters: ActiveFilters
  // Called after a filter change reflows the layout, so the canvas can
  // re-centre the new cluster in the viewport.
  onLayoutChange?: () => void
}

const COL_COUNT = 6
const COL_OFFSETS = ["6vw", "18vw", "2vw", "14vw", "8vw", "20vw"]

// The unfiltered canvas: every piece spread evenly across the staggered columns.
function buildColumns(products: Product[]): Product[][] {
  const cols: Product[][] = Array.from({ length: COL_COUNT }, () => [])
  products.forEach((p, i) => cols[i % COL_COUNT].push(p))
  return cols
}

// A filtered cluster: distribute the matched pieces across the columns so the
// per-column heights follow a circle's chord profile (tall in the middle, short
// at the edges). Combined with vertical centring of each column, the cluster's
// outline reads as a rough circle/oval centred in the viewport.
function buildCircularColumns(items: Product[]): Product[][] {
  const n = items.length
  if (n === 0) return []

  const weights = Array.from({ length: COL_COUNT }, (_, i) => {
    const x = ((i + 0.5) / COL_COUNT) * 2 - 1 // column centre in (-1, 1)
    return Math.sqrt(Math.max(0, 1 - x * x))
  })
  const wsum = weights.reduce((a, b) => a + b, 0)

  const counts = weights.map((w) => Math.round((w / wsum) * n))
  // Rounding rarely sums back to n exactly; nudge counts (center columns first)
  // until it does.
  let diff = n - counts.reduce((a, b) => a + b, 0)
  const byWeight = weights.map((_, i) => i).sort((a, b) => weights[b] - weights[a])
  let oi = 0
  while (diff !== 0) {
    const i = byWeight[oi % COL_COUNT]
    if (diff > 0) {
      counts[i]++
      diff--
    } else if (counts[i] > 0) {
      counts[i]--
      diff++
    }
    oi++
  }

  const cols: Product[][] = Array.from({ length: COL_COUNT }, () => [])
  let k = 0
  for (let i = 0; i < COL_COUNT; i++) {
    for (let c = 0; c < counts[i]; c++) cols[i].push(items[k++])
  }
  return cols
}

export const XpCollection = forwardRef<HTMLDivElement, XpCollectionProps>(function XpCollection(
  { products, onItemClick, itemRefs, filters, onLayoutChange },
  ref,
) {
  const isFiltering = activeFilterCount(filters) > 0

  // Each piece keeps a stable width regardless of which column it lands in, so
  // reclustering doesn't make thumbnails resize mid-flight.
  const widthIndexById = useMemo(() => {
    const m = new Map<string, number>()
    products.forEach((p, i) => m.set(p.id, i))
    return m
  }, [products])

  const layoutProducts = useMemo(
    () => (isFiltering ? products.filter((p) => productMatches(p, filters)) : products),
    [products, filters, isFiltering],
  )

  const columns = useMemo(
    () => (isFiltering ? buildCircularColumns(layoutProducts) : buildColumns(layoutProducts)),
    [layoutProducts, isFiltering],
  )
  // Empty columns would still contribute horizontal gaps and break the cluster's
  // symmetry, so drop them from the filtered layout.
  const renderColumns = isFiltering ? columns.filter((c) => c.length > 0) : columns

  // ── Filter transition ──────────────────────────────────────────────────────
  // A filter change reflows the rendered set into a new cluster. We make the
  // change a single smooth motion:
  //   1. capture each piece's current on-screen position (render phase, before
  //      React commits the new columns),
  //   2. snap the collection to the new centred position (instant, in recenter),
  //   3. Flip-tween the persisting pieces from their old positions to the new
  //      ones so the reflow + recentre read as one glide,
  //   4. fade newly matched pieces in and keep persisting pieces visible.
  // Opacity is handled here (not via Flip enter/leave) so pieces can never be
  // left invisible. The canvas entrance owns the first reveal, so it's skipped.
  const flipStateRef = useRef<ReturnType<typeof Flip.getState> | null>(null)
  const prevKeyRef = useRef<string | null>(null)
  const prevIdsRef = useRef<Set<string>>(new Set())
  const firstRunRef = useRef(true)

  const layoutKey = `${isFiltering ? "f" : "a"}:${JSON.stringify(filters)}`
  if (prevKeyRef.current !== null && prevKeyRef.current !== layoutKey) {
    // Pre-commit: the DOM still shows the old layout, so this records the
    // positions the pieces will glide away from.
    flipStateRef.current = Flip.getState(".xp-item")
  }
  prevKeyRef.current = layoutKey

  useLayoutEffect(() => {
    const renderedIds = new Set(layoutProducts.map((p) => p.id))

    if (firstRunRef.current) {
      firstRunRef.current = false
      prevIdsRef.current = renderedIds
      flipStateRef.current = null
      return
    }

    const state = flipStateRef.current
    flipStateRef.current = null

    // Snap the collection to the new centred position; Flip then provides the
    // visible motion, so there's no separate camera pan to fight the reflow.
    onLayoutChange?.()

    const entering: HTMLElement[] = []
    const persisting: HTMLElement[] = []
    itemRefs.current.forEach((el, id) => {
      if (!renderedIds.has(id)) return
      if (prevIdsRef.current.has(id)) persisting.push(el)
      else entering.push(el)
    })
    prevIdsRef.current = renderedIds

    // Glide persisting pieces from their old positions to the new centred ones.
    // Pieces that no longer match were unmounted by React; Flip re-inserts them
    // at their old spot via onLeave so they can blur out instead of vanishing.
    if (state) {
      Flip.from(state, {
        duration: 0.8,
        ease: "power3.inOut",
        onLeave: (els) =>
          gsap.to(els, {
            opacity: 0,
            scale: 0.9,
            filter: "blur(12px)",
            duration: 0.5,
            ease: "power2.out",
          }),
      })
    }
    // Matching pieces blur in. Persisting pieces keep their Flip position-glide,
    // so only their blur is animated (opacity stays 1 -> no flash, overwrite:false
    // so this doesn't cancel Flip's transform tween). Newly matched pieces fade +
    // blur in from nothing.
    gsap.fromTo(
      persisting,
      { filter: "blur(12px)" },
      {
        opacity: 1,
        filter: "blur(0px)",
        duration: 0.6,
        ease: "power2.out",
        overwrite: false,
      },
    )
    gsap.killTweensOf(entering)
    gsap.fromTo(
      entering,
      { opacity: 0, scale: 0.9, filter: "blur(12px)" },
      {
        opacity: 1,
        scale: 1,
        filter: "blur(0px)",
        duration: 0.6,
        ease: "power2.out",
        stagger: { each: 0.03, from: "random" },
        overwrite: "auto",
      },
    )
  }, [layoutProducts, onLayoutChange, itemRefs])

  return (
    <div ref={ref} className="xp-collection" style={isFiltering ? { alignItems: "center" } : undefined}>
      {renderColumns.map((col, ci) => (
        <div
          key={ci}
          className="xp-column"
          style={{
            marginTop: isFiltering ? 0 : COL_OFFSETS[ci],
            marginRight: ci < renderColumns.length - 1 ? "12vw" : 0,
          }}
        >
          {col.map((product) => (
            <XpProductItem
              key={product.id}
              product={product}
              index={widthIndexById.get(product.id) ?? 0}
              onClick={onItemClick}
              itemRef={(el) => {
                if (el) itemRefs.current.set(product.id, el)
                else itemRefs.current.delete(product.id)
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
})
