import { clsx } from "clsx"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { XpWrapper } from "../../components/canvas/xp-wrapper"
import { GridCollection } from "../../components/grid/grid-collection"
import { EmptyFilterState } from "../../components/ui/empty-filter-state"
import { Navbar } from "../../components/ui/navbar"
import { ZoomControls } from "../../components/ui/zoom-controls"
import { useHomeCatalog } from "../../hooks/use-home-catalog"
import { useIsMobile } from "../../hooks/use-is-mobile"
import { useXpCanvas } from "../../hooks/use-xp-canvas"
import { useArtworkFocus } from "../../lib/artwork-focus"
import type { ActiveFilters, FilterKey } from "../../lib/filters"
import { activeFilterCount, EMPTY_FILTERS, productMatches } from "../../lib/filters"
import { gsap } from "../../lib/gsap"
import { emitPopupAction } from "../../lib/marketing"
import { useTransitionNavigate } from "../../lib/transition"
import type { Product, ViewMode } from "../../lib/types"

const PROXIMITY_RADIUS = 220

type WithVTA = Document & { startViewTransition: (cb: () => void) => { finished: Promise<void> } }

export function HomePage() {
  const isMobile = useIsMobile()
  const [viewMode, setViewMode] = useState<ViewMode>("xp")
  const [filters, setFilters] = useState<ActiveFilters>(EMPTY_FILTERS)
  const { products, filterGroups } = useHomeCatalog(filters)
  const { focusedProduct, openProduct, close: handleCloseFocus, isFocusedRef } = useArtworkFocus()

  const toggleFilter = useCallback((key: FilterKey, value: string) => {
    emitPopupAction("filter")
    setFilters((prev) => {
      const set = prev[key]
      const next = set.includes(value) ? set.filter((v) => v !== value) : [...set, value]
      return { ...prev, [key]: next }
    })
  }, [])

  const clearFilters = useCallback(() => setFilters(EMPTY_FILTERS), [])

  const transitionNavigate = useTransitionNavigate()
  const goToSpecialRequest = useCallback(
    () => transitionNavigate("/contact?inquiry=custom"),
    [transitionNavigate],
  )

  const hasActiveFilters = activeFilterCount(filters) > 0
  const matchCount = useMemo(
    () => products.filter((p) => productMatches(p, filters)).length,
    [filters, products],
  )
  const noMatches = hasActiveFilters && matchCount === 0

  const xpItemRefs = useRef<Map<string, HTMLElement>>(new Map())
  const gridItemRefs = useRef<Map<string, HTMLElement>>(new Map())
  const reopenedArtworkRef = useRef<string | null>(null)
  const viewTransitioningRef = useRef(false)
  const gridWrapperRef = useRef<HTMLDivElement>(null)

  const {
    wrapperRef,
    collectionRef,
    zoomLevel,
    zoomIn,
    zoomOut,
    runEntrance,
    entranceComplete,
    recenter,
  } = useXpCanvas(viewMode === "xp", isFocusedRef)

  // Run the canvas entrance once the artworks have actually loaded (they stream
  // in async from Convex, so the pieces don't exist on first render). Hide them
  // before paint so they don't flash before the staggered pop-in, then play it
  // once layout has settled.
  const entranceStartedRef = useRef(false)
  useLayoutEffect(() => {
    if (entranceStartedRef.current || products.length === 0) return
    entranceStartedRef.current = true
    const collection = collectionRef.current
    if (collection) gsap.set(collection.querySelectorAll(".xp-item"), { opacity: 0 })
    const id = window.setTimeout(() => runEntrance(), 100)
    return () => window.clearTimeout(id)
  }, [products.length, runEntrance, collectionRef])

  // ── Proximity zoom ───────────────────────────────────────────────────────
  useEffect(() => {
    if (viewMode !== "xp") return
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const onMouseMove = (e: MouseEvent) => {
      const items = wrapper.querySelectorAll<HTMLElement>(".xp-item")

      items.forEach((item) => {
        // Skip pieces filtered out of the current view.
        if (item.dataset.filtered === "true") return
        const rect = item.getBoundingClientRect()
        if (
          rect.right < 0 ||
          rect.left > window.innerWidth ||
          rect.bottom < 0 ||
          rect.top > window.innerHeight
        ) {
          gsap.to(item, { scale: 1, duration: 0.5, overwrite: "auto" })
          return
        }
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const dist = Math.hypot(e.clientX - cx, e.clientY - cy)
        const factor = Math.max(0, 1 - dist / PROXIMITY_RADIUS)
        const scale = 1 + factor * 0.15
        gsap.to(item, { scale, duration: 0.35, ease: "power2.out", overwrite: "auto" })
      })
    }

    const onMouseLeave = () => {
      const items = wrapper.querySelectorAll<HTMLElement>(".xp-item")
      items.forEach((item) => gsap.to(item, { scale: 1, duration: 0.5, overwrite: "auto" }))
    }

    wrapper.addEventListener("mousemove", onMouseMove)
    wrapper.addEventListener("mouseleave", onMouseLeave)
    return () => {
      wrapper.removeEventListener("mousemove", onMouseMove)
      wrapper.removeEventListener("mouseleave", onMouseLeave)
    }
  }, [viewMode, wrapperRef])

  // ── View toggle ──────────────────────────────────────────────────────────
  const toggleView = useCallback(() => {
    if (viewTransitioningRef.current || isFocusedRef.current) return
    viewTransitioningRef.current = true

    if ("startViewTransition" in document) {
      const vt = (document as WithVTA).startViewTransition(() => {
        flushSync(() => {
          setViewMode((prev) => (prev === "xp" ? "grid" : "xp"))
        })
      })
      vt.finished.finally(() => {
        viewTransitioningRef.current = false
      })
    } else {
      setViewMode((prev) => (prev === "xp" ? "grid" : "xp"))
      viewTransitioningRef.current = false
    }
  }, [isFocusedRef])

  // ── Logo → canvas ─────────────────────────────────────────────────────────
  // The top-left logo always returns to the canvas: it closes any focused artwork
  // and switches grid -> canvas (with the same view-transition morph the toggle
  // uses), even when we're already on the home page.
  const goToCanvasView = useCallback(() => {
    if (isFocusedRef.current) handleCloseFocus()
    if (viewMode === "xp" || viewTransitioningRef.current) return
    viewTransitioningRef.current = true
    if ("startViewTransition" in document) {
      const vt = (document as WithVTA).startViewTransition(() => {
        flushSync(() => setViewMode("xp"))
      })
      vt.finished.finally(() => {
        viewTransitioningRef.current = false
      })
    } else {
      setViewMode("xp")
      viewTransitioningRef.current = false
    }
  }, [handleCloseFocus, isFocusedRef, viewMode])

  // ── Item click ───────────────────────────────────────────────────────────
  // The clicked piece morphs into the focus panel; the canvas/grid slides aside.
  const handleXpItemClick = useCallback(
    (product: Product, el: HTMLElement) => {
      // Ignore clicks until the intro pop-in/zoom sequence has finished, so the
      // focus morph doesn't fire mid-animation with the canvas still in motion.
      if (!entranceComplete) return
      openProduct(product, el, wrapperRef.current)
    },
    [openProduct, entranceComplete, wrapperRef],
  )

  const handleGridItemClick = useCallback(
    (product: Product, el: HTMLElement) => openProduct(product, el, gridWrapperRef.current),
    [openProduct],
  )

  useEffect(() => {
    if (typeof window === "undefined" || focusedProduct || !entranceComplete) return

    const slug = new URLSearchParams(window.location.search).get("artwork")
    if (!slug || reopenedArtworkRef.current === slug) return

    const product = products.find((p) => p.slug === slug)
    const el = product ? xpItemRefs.current.get(product.id) : null
    if (!product || !el) return

    reopenedArtworkRef.current = slug
    openProduct(product, el, wrapperRef.current)
  }, [entranceComplete, focusedProduct, openProduct, products, wrapperRef])

  return (
    <div
      className="site-screen relative w-screen overflow-hidden"
      style={{ background: "#f0ede6" }}
    >
      <Navbar
        viewMode={viewMode}
        onToggleView={toggleView}
        showViewToggle
        showCta={!!focusedProduct}
        onLogoClick={goToCanvasView}
        showFilter={viewMode === "xp" && !focusedProduct}
        filterGroups={filterGroups}
        activeFilters={filters}
        onToggleFilter={toggleFilter}
        onClearFilters={clearFilters}
      />

      {/* XP Canvas */}
      <div
        className={clsx(
          "absolute inset-0",
          viewMode === "xp" ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <XpWrapper
          ref={wrapperRef}
          products={products}
          onItemClick={handleXpItemClick}
          collectionRef={collectionRef}
          itemRefs={xpItemRefs}
          visible
          filters={filters}
          onLayoutChange={recenter}
        />
      </div>

      {/* Grid view */}
      <div
        ref={gridWrapperRef}
        className={clsx(
          "absolute inset-0 overflow-y-auto",
          viewMode === "grid" ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <GridCollection
          products={products}
          filters={filters}
          filterGroups={filterGroups}
          onToggleFilter={toggleFilter}
          onClearFilters={clearFilters}
          onItemClick={handleGridItemClick}
          onContact={goToSpecialRequest}
          itemRefs={gridItemRefs}
          visible={viewMode === "grid"}
          scrollerRef={gridWrapperRef}
        />
      </div>

      {/* Empty-filter message on the canvas */}
      {viewMode === "xp" && !focusedProduct && noMatches && (
        <div className="pointer-events-none absolute inset-0 z-[150] flex items-center justify-center">
          <EmptyFilterState onContact={goToSpecialRequest} />
        </div>
      )}

      {viewMode === "xp" && !focusedProduct && (
        <ZoomControls level={zoomLevel} onZoomIn={zoomIn} onZoomOut={zoomOut} />
      )}

      {viewMode === "xp" &&
        !focusedProduct && (
          // Lifted above the bottom control bar on mobile; the gesture is a finger
          // drag on touch, a scroll on desktop.
          <p className="fixed bottom-28 left-6 z-10 text-[10px] font-medium tracking-widest text-dark/30 uppercase md:bottom-9 md:left-10">
            {isMobile ? "Drag to explore" : "Scroll to navigate"}
          </p>
        )}
    </div>
  )
}
