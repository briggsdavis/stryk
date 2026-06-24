import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { ActiveFilters } from "../../lib/filters"
import { activeFilterCount, productMatches } from "../../lib/filters"
import { gsap } from "../../lib/gsap"
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
  // Keep a local handle on the collection element alongside the forwarded ref so
  // we can drive the crossfade.
  const innerRef = useRef<HTMLDivElement | null>(null)
  const setCollectionRef = useCallback(
    (node: HTMLDivElement | null) => {
      innerRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
    },
    [ref],
  )

  // The layout is rendered from `displayedFilters`, which lags the incoming
  // `filters` prop: a filter change first blurs the current cluster out, and only
  // once it's hidden do we swap to the new layout (see the crossfade below). That
  // way the reflow + recentre never happen on screen.
  const [displayedFilters, setDisplayedFilters] = useState(filters)
  const isFiltering = activeFilterCount(displayedFilters) > 0

  // Each piece keeps a stable width regardless of which column it lands in, so
  // reclustering doesn't make thumbnails resize.
  const widthIndexById = useMemo(() => {
    const m = new Map<string, number>()
    products.forEach((p, i) => m.set(p.id, i))
    return m
  }, [products])

  const layoutProducts = useMemo(
    () => (isFiltering ? products.filter((p) => productMatches(p, displayedFilters)) : products),
    [products, displayedFilters, isFiltering],
  )

  const columns = useMemo(
    () => (isFiltering ? buildCircularColumns(layoutProducts) : buildColumns(layoutProducts)),
    [layoutProducts, isFiltering],
  )
  // Empty columns would still contribute horizontal gaps and break the cluster's
  // symmetry, so drop them from the filtered layout.
  const renderColumns = isFiltering ? columns.filter((c) => c.length > 0) : columns

  // ── Filter crossfade ─────────────────────────────────────────────────────────
  // A filter change is a calm whole-cluster blur crossfade rather than per-piece
  // motion: blur/fade the current cluster out, swap to the new layout and recentre
  // *while it's invisible* (so nothing is seen sliding around), then blur/fade the
  // new cluster in. The canvas entrance owns the very first reveal, so both phases
  // skip the initial mount.
  const fadeOutFirstRef = useRef(true)
  const fadeInFirstRef = useRef(true)

  // Phase 1: incoming filter differs -> blur the old cluster out, then swap.
  useEffect(() => {
    if (fadeOutFirstRef.current) {
      fadeOutFirstRef.current = false
      return
    }
    if (filters === displayedFilters) return
    const collection = innerRef.current
    if (!collection) {
      setDisplayedFilters(filters)
      return
    }
    const incoming = filters
    gsap.killTweensOf(collection)
    gsap.to(collection, {
      opacity: 0,
      filter: "blur(12px)",
      duration: 0.35,
      ease: "power2.inOut",
      onComplete: () => setDisplayedFilters(incoming),
    })
  }, [filters, displayedFilters])

  // Phase 2: the swapped layout has committed and is still hidden -> make its
  // pieces visible, recentre, then blur the whole cluster back in.
  useLayoutEffect(() => {
    if (fadeInFirstRef.current) {
      fadeInFirstRef.current = false
      return
    }
    const collection = innerRef.current
    if (!collection) return

    const items = collection.querySelectorAll<HTMLElement>(".xp-item")
    gsap.set(items, { opacity: 1, scale: 1, filter: "blur(0px)" })

    onLayoutChange?.()

    gsap.killTweensOf(collection)
    gsap.fromTo(
      collection,
      { opacity: 0, filter: "blur(12px)" },
      { opacity: 1, filter: "blur(0px)", duration: 0.55, ease: "power2.out" },
    )
  }, [displayedFilters, onLayoutChange])

  return (
    <div
      ref={setCollectionRef}
      className="xp-collection"
      style={isFiltering ? { alignItems: "center" } : undefined}
    >
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
