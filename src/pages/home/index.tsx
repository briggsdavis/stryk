import { clsx } from "clsx"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { XpWrapper } from "../../components/canvas/xp-wrapper"
import { FocusWrapper } from "../../components/focus/focus-wrapper"
import { GridCollection } from "../../components/grid/grid-collection"
import { IntroScreen } from "../../components/ui/intro-screen"
import { Navbar } from "../../components/ui/navbar"
import { ZoomControls } from "../../components/ui/zoom-controls"
import { useXpCanvas } from "../../hooks/use-xp-canvas"
import { Flip, gsap } from "../../lib/gsap"
import { DEMO_PRODUCTS } from "../../lib/demo-data"
import type { Product, ViewMode } from "../../lib/types"

const CANVAS_SHIFT = "60vw"
const PROXIMITY_RADIUS = 220

export function HomePage() {
  const [introComplete, setIntroComplete] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("xp")
  const [focusedProduct, setFocusedProduct] = useState<Product | null>(null)

  const xpItemRefs = useRef<Map<string, HTMLElement>>(new Map())
  const gridItemRefs = useRef<Map<string, HTMLElement>>(new Map())
  const focusedElRef = useRef<HTMLElement | null>(null)
  const placeholderRef = useRef<HTMLElement | null>(null)
  const originalSizeRef = useRef<{ w: string; h: string }>({ w: "", h: "" })
  const flipStateRef = useRef<ReturnType<typeof Flip.getState> | null>(null)
  const viewTransitioningRef = useRef(false)
  const isFocusedRef = useRef(false)

  const { wrapperRef, collectionRef, zoomLevel, zoomIn, zoomOut, runEntrance } =
    useXpCanvas(introComplete && viewMode === "xp")

  // ── Intro ────────────────────────────────────────────────────────────────
  const handleIntroComplete = useCallback(() => {
    setIntroComplete(true)
    setTimeout(() => runEntrance(), 60)
  }, [runEntrance])

  // ── Proximity zoom + cursor ──────────────────────────────────────────────
  useEffect(() => {
    if (!introComplete || viewMode !== "xp") return
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const onMouseMove = (e: MouseEvent) => {
      const items = wrapper.querySelectorAll<HTMLElement>(".xp-item")
      let closestDist = Infinity
      let closestName = ""

      items.forEach((item) => {
        const rect = item.getBoundingClientRect()
        if (rect.right < 0 || rect.left > window.innerWidth ||
            rect.bottom < 0 || rect.top > window.innerHeight) {
          gsap.to(item, { scale: 1, duration: 0.5, overwrite: "auto" })
          return
        }
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const dist = Math.hypot(e.clientX - cx, e.clientY - cy)
        const factor = Math.max(0, 1 - dist / PROXIMITY_RADIUS)
        const scale = 1 + factor * 0.15
        gsap.to(item, { scale, duration: 0.35, ease: "power2.out", overwrite: "auto" })
        if (dist < closestDist) { closestDist = dist; closestName = item.dataset.cursor ?? "" }
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
  }, [introComplete, viewMode, wrapperRef])

  // ── View toggle ──────────────────────────────────────────────────────────
  const toggleView = useCallback(() => {
    if (viewTransitioningRef.current || isFocusedRef.current) return
    viewTransitioningRef.current = true
    const currentItems =
      viewMode === "xp"
        ? [...xpItemRefs.current.values()]
        : [...gridItemRefs.current.values()]
    flipStateRef.current = Flip.getState(currentItems)
    setViewMode((prev) => (prev === "xp" ? "grid" : "xp"))
  }, [viewMode])

  useLayoutEffect(() => {
    const state = flipStateRef.current
    if (!state) return
    flipStateRef.current = null
    Flip.from(state, {
      duration: 0.85,
      ease: "expo.inOut",
      stagger: 0.012,
      absolute: true,
      onComplete: () => { viewTransitioningRef.current = false },
    })
  })

  // ── Item click ───────────────────────────────────────────────────────────
  // Replace the clicked element with a same-size placeholder so the canvas
  // layout keeps its gap instead of collapsing, then morph the element into the slot.
  const beginFocus = useCallback(
    (product: Product, el: HTMLElement, slideCanvas: boolean) => {
      if (isFocusedRef.current) return
      isFocusedRef.current = true

      const slot = document.getElementById("focus-image-slot")
      if (!slot) {
        isFocusedRef.current = false
        return
      }

      focusedElRef.current = el
      originalSizeRef.current = { w: el.style.width, h: el.style.height }

      // Capture the element's CURRENT on-screen rect — including the proximity
      // hover-zoom (scale ~1.15) it has right now. The morph must start from the
      // size it's actually displayed at, so there's no snap. We pin this rect as
      // the morph's start size and simultaneously clear the scale transform (in
      // the gsap.set below), so the visual size is identical but no leftover
      // transform survives to overflow/clip the frame at the end.
      const fromRect = el.getBoundingClientRect()

      // Leave a same-size placeholder so the canvas column keeps its gap
      // instead of collapsing upward.
      const placeholder = document.createElement("div")
      placeholder.style.width = `${el.offsetWidth}px`
      placeholder.style.height = `${el.offsetHeight}px`
      placeholder.style.flexShrink = "0"
      placeholderRef.current = placeholder
      el.parentElement?.replaceChild(placeholder, el)

      // Size the focus frame to the clicked image's exact aspect ratio, scaled
      // to fit a max box in the left panel. Because the destination then shares
      // the source's aspect ratio, the morph below is a pure scale + reposition
      // — the crop and aspect ratio never change.
      const aspect = fromRect.width / fromRect.height
      const frame = document.getElementById("focus-image-frame")
      if (frame) {
        const maxW = Math.min(window.innerWidth * 0.36, 440)
        const maxH = window.innerHeight * 0.64
        let tw = maxW
        let th = tw / aspect
        if (th > maxH) {
          th = maxH
          tw = th * aspect
        }
        frame.style.width = `${tw}px`
        frame.style.height = `${th}px`
      }

      // Render the panel; the frame now has its final (aspect-matched) geometry,
      // so the destination slot rect matches the source aspect ratio exactly.
      setFocusedProduct(product)
      const toRect = slot.getBoundingClientRect()

      // Morph in an unclipped fixed layer on top of everything: the image
      // travels through space with no overflow:hidden ancestor, so it stays
      // visible the entire slide instead of being clipped to nothing.
      document.body.appendChild(el)
      gsap.set(el, { position: "fixed", margin: 0, zIndex: 9000, scale: 1 })

      if (slideCanvas && wrapperRef.current) {
        gsap.to(wrapperRef.current, { x: CANVAS_SHIFT, duration: 1.1, ease: "expo.inOut" })
      }

      // fromTo pins BOTH the start and end of left/top/width/height so the size
      // is interpolated the whole way (a plain .to() can infer the wrong start
      // if React touches the node on the same tick, which makes the size snap
      // only at the end — the "flash" we're killing here).
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
            // Hand off into the slot; the slot CSS (100%/100%) makes the image
            // fill it exactly, matching where the morph landed — seamless.
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
    (product: Product, el: HTMLElement) => beginFocus(product, el, true),
    [beginFocus],
  )

  const handleGridItemClick = useCallback(
    (product: Product, el: HTMLElement) => beginFocus(product, el, false),
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

    // Image's current on-screen rect (sitting in the panel slot).
    const fromRect = el.getBoundingClientRect()

    // Where the placeholder will be once the canvas slides back to x:0.
    // The canvas is currently shifted right by CANVAS_SHIFT, so the resting
    // position is the placeholder's current rect minus that shift.
    const shift = window.innerWidth * 0.6
    const pr = placeholder.getBoundingClientRect()
    const toRect = { left: pr.left - shift, top: pr.top, width: pr.width, height: pr.height }

    // Lift into the same unclipped fixed layer at its current spot, then morph
    // back to the empty canvas slot — never clipped, always visible.
    document.body.appendChild(el)
    gsap.set(el, { position: "fixed", margin: 0, zIndex: 9000, scale: 1 })

    // Slide canvas back LEFT so the placeholder lands exactly at toRect.
    if (wrapperRef.current) {
      gsap.to(wrapperRef.current, { x: 0, duration: 1.1, ease: "expo.inOut" })
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
        // Drop back into the canvas column where the placeholder held the gap,
        // and restore its original vw size.
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
    })
  }, [wrapperRef])

  return (
    <div className="relative h-screen w-screen overflow-hidden" style={{ background: "#f0ede6" }}>
      {!introComplete && <IntroScreen onComplete={handleIntroComplete} />}

      <Navbar
        viewMode={viewMode}
        onToggleView={toggleView}
        showViewToggle={introComplete && !focusedProduct}
      />

      {/* XP Canvas */}
      <div
        className={clsx(
          "absolute inset-0 transition-opacity duration-500",
          viewMode === "xp" && introComplete ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <XpWrapper
          ref={wrapperRef}
          products={DEMO_PRODUCTS}
          onItemClick={handleXpItemClick}
          collectionRef={collectionRef}
          itemRefs={xpItemRefs}
          visible
        />
      </div>

      {/* Grid view */}
      <div
        className={clsx(
          "absolute inset-0 overflow-y-auto transition-opacity duration-500",
          viewMode === "grid" ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <GridCollection
          products={DEMO_PRODUCTS}
          onItemClick={handleGridItemClick}
          itemRefs={gridItemRefs}
          visible={viewMode === "grid"}
        />
      </div>

      {/* Focus panel — sits over canvas, no white backdrop, just the panel content */}
      <FocusWrapper
        product={focusedProduct}
        allProducts={DEMO_PRODUCTS}
        onClose={handleCloseFocus}
      />

      {viewMode === "xp" && introComplete && !focusedProduct && (
        <ZoomControls level={zoomLevel} onZoomIn={zoomIn} onZoomOut={zoomOut} />
      )}

      {viewMode === "xp" && introComplete && !focusedProduct && (
        <p className="fixed bottom-9 left-6 z-10 text-[10px] font-medium uppercase tracking-widest text-dark/30 md:left-10">
          Scroll to navigate
        </p>
      )}
    </div>
  )
}
