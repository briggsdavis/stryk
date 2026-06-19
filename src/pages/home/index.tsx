import { clsx } from "clsx"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { XpWrapper } from "../../components/canvas/xp-wrapper"
import { FocusWrapper } from "../../components/focus/focus-wrapper"
import { GridCollection } from "../../components/grid/grid-collection"
import { EmptyFilterState } from "../../components/ui/empty-filter-state"
import { Navbar } from "../../components/ui/navbar"
import { ZoomControls } from "../../components/ui/zoom-controls"
import { useXpCanvas } from "../../hooks/use-xp-canvas"
import { DEMO_PRODUCTS } from "../../lib/demo-data"
import type { ActiveFilters, FilterKey } from "../../lib/filters"
import {
  activeFilterCount,
  buildFilterGroups,
  EMPTY_FILTERS,
  productMatches,
} from "../../lib/filters"
import { gsap } from "../../lib/gsap"
import { useTransitionNavigate } from "../../lib/transition"
import type { Product, ViewMode } from "../../lib/types"

const CANVAS_SHIFT = "60vw"
const PROXIMITY_RADIUS = 220
const FILTER_GROUPS = buildFilterGroups(DEMO_PRODUCTS)

type WithVTA = Document & { startViewTransition: (cb: () => void) => { finished: Promise<void> } }

export function HomePage() {
  const [viewMode, setViewMode] = useState<ViewMode>("xp")
  const [focusedProduct, setFocusedProduct] = useState<Product | null>(null)
  const [filters, setFilters] = useState<ActiveFilters>(EMPTY_FILTERS)

  const toggleFilter = useCallback((key: FilterKey, value: string) => {
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
    () => DEMO_PRODUCTS.filter((p) => productMatches(p, filters)).length,
    [filters],
  )
  const noMatches = hasActiveFilters && matchCount === 0

  const xpItemRefs = useRef<Map<string, HTMLElement>>(new Map())
  const gridItemRefs = useRef<Map<string, HTMLElement>>(new Map())
  const focusedElRef = useRef<HTMLElement | null>(null)
  const placeholderRef = useRef<HTMLElement | null>(null)
  const originalSizeRef = useRef<{ w: string; h: string }>({ w: "", h: "" })
  const viewTransitioningRef = useRef(false)
  const isFocusedRef = useRef(false)
  const gridWrapperRef = useRef<HTMLDivElement>(null)
  const focusSourceRef = useRef<"canvas" | "grid">("canvas")

  const { wrapperRef, collectionRef, zoomLevel, zoomIn, zoomOut, runEntrance, entranceComplete } =
    useXpCanvas(viewMode === "xp")

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
        if (dist < closestDist) {
          closestDist = dist
          closestName = item.dataset.cursor ?? ""
        }
      })

      window.dispatchEvent(
        new CustomEvent("canvas-hover", { detail: { name: closestName, dist: closestDist } }),
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
  }, [])

  // ── Item click ───────────────────────────────────────────────────────────
  const beginFocus = useCallback(
    (product: Product, el: HTMLElement, source: "canvas" | "grid") => {
      if (isFocusedRef.current) return
      isFocusedRef.current = true
      focusSourceRef.current = source

      const slot = document.getElementById("focus-image-slot")
      if (!slot) {
        isFocusedRef.current = false
        return
      }

      focusedElRef.current = el
      originalSizeRef.current = { w: el.style.width, h: el.style.height }

      const fromRect = el.getBoundingClientRect()

      const placeholder = document.createElement("div")
      placeholder.style.width = `${el.offsetWidth}px`
      placeholder.style.height = `${el.offsetHeight}px`
      placeholder.style.flexShrink = "0"
      placeholderRef.current = placeholder
      el.parentElement?.replaceChild(placeholder, el)

      const aspect = fromRect.width / fromRect.height
      const frame = document.getElementById("focus-image-frame")
      if (frame) {
        // Reserve a band at the top for the collection title and one at the
        // bottom for the info/options strip, then size + centre the image
        // within what's left. This is a universal guard: the image's top edge
        // can never rise into the title (the "Tokyo O" overlap), regardless of
        // artwork aspect ratio or viewport size.
        //
        // Title metrics mirror the <h2>: top-16/top-24 offset + clamp(3rem,
        // 7vw, 6rem) font size, so the reserve scales with the viewport.
        const isMd = window.innerWidth >= 768
        const titleTop = isMd ? 96 : 64
        const titleFont = Math.min(Math.max(window.innerWidth * 0.07, 48), 96)
        const topReserve = titleTop + titleFont + 28
        // The focus panel opens with its details collapsed, so the bottom strip
        // is just the gallery indicator + product title. The details dropdown
        // grows this reserve (and shrinks the image) on demand from within the
        // focus panel. Keep this in sync with COLLAPSED_RESERVE there.
        const bottomReserve = 150

        const maxW = Math.min(window.innerWidth * 0.36, 440)
        const maxH = Math.max(window.innerHeight - topReserve - bottomReserve, 200)
        let tw = maxW
        let th = tw / aspect
        if (th > maxH) {
          th = maxH
          tw = th * aspect
        }
        frame.style.width = `${tw}px`
        frame.style.height = `${th}px`
        // Centre within the reserved band rather than the full panel height.
        frame.style.top = `${topReserve}px`
        frame.style.bottom = `${bottomReserve}px`
      }

      setFocusedProduct(product)
      const toRect = slot.getBoundingClientRect()

      document.body.appendChild(el)
      gsap.killTweensOf(el)
      gsap.set(el, { position: "fixed", margin: 0, zIndex: 9000, scale: 1 })

      if (source === "canvas" && wrapperRef.current) {
        gsap.to(wrapperRef.current, { x: CANVAS_SHIFT, duration: 1.1, ease: "expo.inOut" })
      } else if (source === "grid" && gridWrapperRef.current) {
        gsap.to(gridWrapperRef.current, { x: CANVAS_SHIFT, duration: 1.1, ease: "expo.inOut" })
      }

      gsap.fromTo(
        el,
        { left: fromRect.left, top: fromRect.top, width: fromRect.width, height: fromRect.height },
        {
          left: toRect.left,
          top: toRect.top,
          width: toRect.width,
          height: toRect.height,
          duration: 1.1,
          ease: "expo.inOut",
          onComplete: () => {
            slot.appendChild(el)
            gsap.set(el, { clearProps: "position,top,left,zIndex,margin" })
            el.style.width = ""
            el.style.height = ""
          },
        },
      )
    },
    [wrapperRef],
  )

  const handleXpItemClick = useCallback(
    (product: Product, el: HTMLElement) => {
      // Ignore clicks until the intro pop-in/zoom sequence has finished, so the
      // focus morph doesn't fire mid-animation with the canvas still in motion.
      if (!entranceComplete) return
      beginFocus(product, el, "canvas")
    },
    [beginFocus, entranceComplete],
  )

  const handleGridItemClick = useCallback(
    (product: Product, el: HTMLElement) => beginFocus(product, el, "grid"),
    [beginFocus],
  )

  // ── Close focus ──────────────────────────────────────────────────────────
  const handleCloseFocus = useCallback(() => {
    const el = focusedElRef.current
    const placeholder = placeholderRef.current
    if (!el || !placeholder?.parentElement) {
      isFocusedRef.current = false
      setFocusedProduct(null)
      return
    }

    const fromRect = el.getBoundingClientRect()

    const shift = window.innerWidth * 0.6
    const pr = placeholder.getBoundingClientRect()
    const toRect = { left: pr.left - shift, top: pr.top, width: pr.width, height: pr.height }

    document.body.appendChild(el)
    gsap.set(el, { position: "fixed", margin: 0, zIndex: 9000, scale: 1 })

    if (focusSourceRef.current === "canvas" && wrapperRef.current) {
      gsap.to(wrapperRef.current, { x: 0, duration: 1.1, ease: "expo.inOut" })
    } else if (focusSourceRef.current === "grid" && gridWrapperRef.current) {
      gsap.to(gridWrapperRef.current, { x: 0, duration: 1.1, ease: "expo.inOut" })
    }

    gsap.fromTo(
      el,
      { left: fromRect.left, top: fromRect.top, width: fromRect.width, height: fromRect.height },
      {
        left: toRect.left,
        top: toRect.top,
        width: toRect.width,
        height: toRect.height,
        duration: 1.1,
        ease: "expo.inOut",
        onComplete: () => {
          placeholder.parentElement?.replaceChild(el, placeholder)
          placeholderRef.current = null
          gsap.set(el, { clearProps: "top,left,zIndex,margin" })
          el.style.position = "relative"
          el.style.width = originalSizeRef.current.w
          el.style.height = originalSizeRef.current.h
          focusedElRef.current = null
          isFocusedRef.current = false
          setFocusedProduct(null)
        },
      },
    )
  }, [wrapperRef])

  // unused layout effect removed (was for Flip.from)
  useLayoutEffect(() => {}, [])

  return (
    <div className="relative h-screen w-screen overflow-hidden" style={{ background: "#f0ede6" }}>
      <Navbar
        viewMode={viewMode}
        onToggleView={toggleView}
        showViewToggle={!focusedProduct}
        showCta={!!focusedProduct}
        showFilter={viewMode === "xp" && !focusedProduct}
        filterGroups={FILTER_GROUPS}
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
          products={DEMO_PRODUCTS}
          onItemClick={handleXpItemClick}
          collectionRef={collectionRef}
          itemRefs={xpItemRefs}
          visible
          filters={filters}
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
          products={DEMO_PRODUCTS}
          filters={filters}
          filterGroups={FILTER_GROUPS}
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
        allProducts={DEMO_PRODUCTS}
        onClose={handleCloseFocus}
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
