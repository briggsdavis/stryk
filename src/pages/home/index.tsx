import { clsx } from "clsx"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { XpWrapper } from "../../components/canvas/xp-wrapper"
import { FocusWrapper } from "../../components/focus/focus-wrapper"
import { GridCollection } from "../../components/grid/grid-collection"
import { EmptyFilterState } from "../../components/ui/empty-filter-state"
import { Navbar } from "../../components/ui/navbar"
import { ZoomControls } from "../../components/ui/zoom-controls"
import { useHomeCatalog } from "../../hooks/use-home-catalog"
import { useProductFocus } from "../../hooks/use-product-focus"
import { useXpCanvas } from "../../hooks/use-xp-canvas"
import type { ActiveFilters, FilterKey } from "../../lib/filters"
import { activeFilterCount, EMPTY_FILTERS, productMatches } from "../../lib/filters"
import { gsap } from "../../lib/gsap"
import { emitPopupAction } from "../../lib/marketing"
import { useTransitionNavigate } from "../../lib/transition"
import type { Product, ViewMode } from "../../lib/types"

const PROXIMITY_RADIUS = 220

type WithVTA = Document & { startViewTransition: (cb: () => void) => { finished: Promise<void> } }

export function HomePage() {
  const [viewMode, setViewMode] = useState<ViewMode>("xp")
  const [filters, setFilters] = useState<ActiveFilters>(EMPTY_FILTERS)
  const { products, filterGroups } = useHomeCatalog(filters)
  const {
    focusedProduct,
    beginFocus,
    switchFocus,
    handleClose: handleCloseFocus,
    isFocusedRef,
  } = useProductFocus()

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
  } = useXpCanvas(viewMode === "xp")

  // Run canvas entrance animation on mount
  useEffect(() => {
    const id = setTimeout(() => runEntrance(), 100)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Proximity zoom + cursor ──────────────────────────────────────────────
  useEffect(() => {
    if (viewMode !== "xp") return
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const onMouseMove = (e: MouseEvent) => {
      const items = wrapper.querySelectorAll<HTMLElement>(".xp-item")
      let closestDist = Infinity
      let closestName = ""
      let hoveredName = ""

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
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          hoveredName = item.dataset.cursor ?? ""
        }
        if (dist < closestDist) {
          closestDist = dist
          closestName = item.dataset.cursor ?? ""
        }
      })

      window.dispatchEvent(
        new CustomEvent("canvas-hover", {
          detail: { name: hoveredName, proximityName: closestName, dist: closestDist },
        }),
      )
    }

    const onMouseLeave = () => {
      const items = wrapper.querySelectorAll<HTMLElement>(".xp-item")
      items.forEach((item) => gsap.to(item, { scale: 1, duration: 0.5, overwrite: "auto" }))
      window.dispatchEvent(new CustomEvent("canvas-hover", { detail: { name: "", dist: 9999 } }))
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

  // ── Item click ───────────────────────────────────────────────────────────
  // The clicked piece morphs into the focus panel; the canvas/grid slides aside.
  const handleXpItemClick = useCallback(
    (product: Product, el: HTMLElement) => {
      // Ignore clicks until the intro pop-in/zoom sequence has finished, so the
      // focus morph doesn't fire mid-animation with the canvas still in motion.
      if (!entranceComplete) return
      beginFocus(product, el, wrapperRef.current)
    },
    [beginFocus, entranceComplete, wrapperRef],
  )

  const handleGridItemClick = useCallback(
    (product: Product, el: HTMLElement) => beginFocus(product, el, gridWrapperRef.current),
    [beginFocus],
  )

  return (
    <div className="relative h-screen w-screen overflow-hidden" style={{ background: "#f0ede6" }}>
      <Navbar
        viewMode={viewMode}
        onToggleView={toggleView}
        showViewToggle={!focusedProduct}
        showCta={!!focusedProduct}
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

      {/* Focus panel */}
      <FocusWrapper
        product={focusedProduct}
        allProducts={products}
        onClose={handleCloseFocus}
        onOpenRecommendation={switchFocus}
      />

      {/* Empty-filter message on the canvas */}
      {viewMode === "xp" && !focusedProduct && noMatches && (
        <div className="pointer-events-none absolute inset-0 z-[150] flex items-center justify-center">
          <EmptyFilterState onContact={goToSpecialRequest} />
        </div>
      )}

      {viewMode === "xp" && !focusedProduct && (
        <ZoomControls level={zoomLevel} onZoomIn={zoomIn} onZoomOut={zoomOut} />
      )}

      {viewMode === "xp" && !focusedProduct && (
        <p className="fixed bottom-9 left-6 z-10 text-[10px] font-medium tracking-widest text-dark/30 uppercase md:left-10">
          Scroll to navigate
        </p>
      )}
    </div>
  )
}
