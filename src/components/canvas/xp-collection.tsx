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
import { CANVAS_ITEM_WIDTH, XpProductItem } from "./xp-product-item"

interface XpCollectionProps {
  products: Product[]
  onItemClick: (product: Product, el: HTMLElement) => void
  itemRefs: React.MutableRefObject<Map<string, HTMLElement>>
  filters: ActiveFilters
  // Called after a filter change reflows the layout, so the canvas can
  // re-centre the new cluster in the viewport.
  onLayoutChange?: () => void
}

type LayoutItem = {
  product: Product
  width: number
  left: number
  top: number
}

type HexCoord = {
  q: number
  r: number
}

const HEX_DIRECTIONS: HexCoord[] = [
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
  { q: 1, r: 0 },
  { q: 1, r: -1 },
]

function hexRing(radius: number): HexCoord[] {
  if (radius === 0) return [{ q: 0, r: 0 }]

  const coords: HexCoord[] = []
  let q = radius
  let r = 0

  for (const direction of HEX_DIRECTIONS) {
    for (let i = 0; i < radius; i++) {
      coords.push({ q, r })
      q += direction.q
      r += direction.r
    }
  }

  return coords
}

function compactRing(radius: number, count: number): HexCoord[] {
  const ring = hexRing(radius)
  if (count >= ring.length) return ring

  const start = Math.floor((ring.length - count) / 2)
  return ring.slice(start, start + count)
}

function buildHexCoords(count: number): HexCoord[] {
  if (count === 0) return []

  const coords: HexCoord[] = [{ q: 0, r: 0 }]
  let remaining = count - 1
  let radius = 1

  while (remaining > 0) {
    const ringCount = Math.min(radius * 6, remaining)
    coords.push(...compactRing(radius, ringCount))
    remaining -= ringCount
    radius++
  }

  return coords
}

function buildCanvasLayout(products: Product[]): { items: LayoutItem[]; width: number; height: number } {
  if (products.length === 0) return { items: [], width: 100, height: 100 }

  const itemWidth = CANVAS_ITEM_WIDTH
  const cellStep = itemWidth * 1.6
  const worldPadding = itemWidth
  const coords = buildHexCoords(products.length)

  const roughItems = products.map((product, i) => {
    const coord = coords[i]
    const width = CANVAS_ITEM_WIDTH
    return {
      product,
      width,
      x: cellStep * (coord.q + coord.r / 2),
      y: cellStep * (Math.sqrt(3) / 2) * coord.r,
    }
  })

  const minX = Math.min(...roughItems.map((item) => item.x - item.width / 2)) - worldPadding
  const maxX = Math.max(...roughItems.map((item) => item.x + item.width / 2)) + worldPadding
  const minY = Math.min(...roughItems.map((item) => item.y - item.width / 2)) - worldPadding
  const maxY = Math.max(...roughItems.map((item) => item.y + item.width / 2)) + worldPadding
  const rawWidth = maxX - minX
  const rawHeight = maxY - minY
  const width = Math.max(100, rawWidth)
  const height = Math.max(100, rawHeight)
  const extraX = (width - rawWidth) / 2
  const extraY = (height - rawHeight) / 2

  return {
    width,
    height,
    items: roughItems.map((item) => ({
      product: item.product,
      width: item.width,
      left: item.x - item.width / 2 - minX + extraX,
      top: item.y - item.width / 2 - minY + extraY,
    })),
  }
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

  const layoutProducts = useMemo(
    () => (isFiltering ? products.filter((p) => productMatches(p, displayedFilters)) : products),
    [products, displayedFilters, isFiltering],
  )

  const layout = useMemo(() => buildCanvasLayout(layoutProducts), [layoutProducts])
  const productsKey = products.map((p) => p.id).join("|")

  // ── Filter crossfade ─────────────────────────────────────────────────────────
  // A filter change is a calm whole-cluster blur crossfade rather than per-piece
  // motion: blur/fade the current cluster out, swap to the new layout and recentre
  // *while it's invisible* (so nothing is seen sliding around), then blur/fade the
  // new cluster in. The canvas entrance owns the very first reveal, so both phases
  // skip the initial mount.
  const fadeOutFirstRef = useRef(true)
  const pendingFilterSwapRef = useRef(false)

  // Phase 1: incoming filter differs -> blur the old cluster out, then swap.
  useEffect(() => {
    if (fadeOutFirstRef.current) {
      fadeOutFirstRef.current = false
      return
    }
    if (filters === displayedFilters) return
    const collection = innerRef.current
    if (!collection) {
      pendingFilterSwapRef.current = true
      setDisplayedFilters(filters)
      return
    }
    const incoming = filters
    pendingFilterSwapRef.current = true
    gsap.killTweensOf(collection, "opacity,filter")
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
    if (!pendingFilterSwapRef.current) {
      return
    }
    pendingFilterSwapRef.current = false
    const collection = innerRef.current
    if (!collection) return

    const items = collection.querySelectorAll<HTMLElement>(".xp-item")
    gsap.set(items, { clearProps: "filter,transform,opacity" })

    onLayoutChange?.()

    gsap.killTweensOf(collection, "opacity,filter")
    gsap.fromTo(
      collection,
      { opacity: 0, filter: "blur(12px)" },
      {
        opacity: 1,
        filter: "blur(0px)",
        duration: 0.55,
        ease: "power2.out",
        onComplete: () => gsap.set(collection, { clearProps: "filter,opacity" }),
      },
    )
  }, [displayedFilters, onLayoutChange])

  const lastProductsKeyRef = useRef(productsKey)
  useLayoutEffect(() => {
    if (lastProductsKeyRef.current === productsKey) {
      return
    }
    lastProductsKeyRef.current = productsKey
    if (!pendingFilterSwapRef.current) {
      const collection = innerRef.current
      if (collection) {
        gsap.killTweensOf(collection, "opacity,filter")
        gsap.set(collection, { clearProps: "filter,opacity" })
      }
    }
    onLayoutChange?.()
  }, [productsKey, onLayoutChange])

  return (
    <div
      ref={setCollectionRef}
      className="xp-collection"
      style={{ width: `${layout.width}vw`, height: `${layout.height}vw` }}
    >
      {layout.items.map((item) => (
        <XpProductItem
          key={item.product.id}
          product={item.product}
          onClick={onItemClick}
          style={{
            position: "absolute",
            left: `${item.left}vw`,
            top: `${item.top}vw`,
            width: `${item.width}vw`,
          }}
          itemRef={(el) => {
            if (el) itemRefs.current.set(item.product.id, el)
            else itemRefs.current.delete(item.product.id)
          }}
        />
      ))}
    </div>
  )
})
