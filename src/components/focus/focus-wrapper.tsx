import { clsx } from "clsx"
import { useQuery } from "convex/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "react-router"
import { api } from "../../../convex/_generated/api"
import { gsap } from "../../lib/gsap"
import { emitPopupAction } from "../../lib/marketing"
import { useTransitionNavigate } from "../../lib/transition"
import type { Product } from "../../lib/types"
import { HoverLabel } from "../ui/hover-label"

interface FocusWrapperProps {
  product: Product | null
  allProducts: Product[]
  onClose: () => void
  // Open a recommended piece from the "complete your set" upsell panel. Re-runs
  // the focus morph for the chosen product without closing first.
  onOpenRecommendation?: (product: Product, sourceEl: HTMLElement) => void
  // Give the panel an opaque background. Needed when it opens over page content
  // that doesn't slide away (e.g. the collection page). On the home canvas the
  // panel must stay transparent so the canvas slide-away morph shows through.
  solidBackdrop?: boolean
}

// Other pieces to suggest alongside the one added to cart, ranked by what they
// share - same collection first, then colour, then category.
function rankRecommendations(current: Product, all: Product[]): Product[] {
  return all
    .filter((p) => p.id !== current.id)
    .map((p) => {
      let score = 0
      if (p.collectionSlug === current.collectionSlug) score += 3
      if (p.colorName === current.colorName) score += 2
      if (p.category === current.category) score += 1
      return { p, score }
    })
    .sort((a, b) => b.score - a.score)
    .map((s) => s.p)
}

// Cap on how many pieces each slot cycles through, so the carousels (and their
// position dots) stay manageable on a large catalogue.
const REC_PER_LANE = 6

// Deal the top-ranked recommendations round-robin into `lanes` slots so the best
// picks fill the slots first and no piece ever appears in two slots at once. Each
// lane is its own carousel the visitor can cycle through.
function buildRecommendationLanes(current: Product, all: Product[], lanes: number): Product[][] {
  const ranked = rankRecommendations(current, all).slice(0, lanes * REC_PER_LANE)
  const result: Product[][] = Array.from({ length: lanes }, () => [])
  ranked.forEach((p, i) => result[i % lanes].push(p))
  return result
}

const REC_DRAG_THRESHOLD = 6

// One recommendation slot: a horizontal snap-track of its lane's pieces. Drag,
// scroll, or use the arrows to cycle; clicking the piece in view opens it.
function RecommendationSlot({
  lane,
  onOpen,
}: {
  lane: Product[]
  onOpen?: (product: Product, sourceEl: HTMLElement) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0, moved: 0 })
  const [index, setIndex] = useState(0)

  const indexFromScroll = () => {
    const t = trackRef.current
    if (!t) return 0
    return Math.min(Math.max(Math.round(t.scrollLeft / (t.clientWidth || 1)), 0), lane.length - 1)
  }

  const scrollToIndex = (i: number) => {
    const t = trackRef.current
    if (!t) return
    const clamped = Math.min(Math.max(i, 0), lane.length - 1)
    t.scrollTo({ left: clamped * t.clientWidth, behavior: "smooth" })
    setIndex(clamped)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    const t = trackRef.current
    if (!t) return
    dragRef.current = { active: true, startX: e.clientX, scrollLeft: t.scrollLeft, moved: 0 }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const t = trackRef.current
    const d = dragRef.current
    if (!t || !d.active) return
    const dx = e.clientX - d.startX
    d.moved = Math.max(d.moved, Math.abs(dx))
    if (d.moved > REC_DRAG_THRESHOLD) {
      t.setPointerCapture(e.pointerId)
      t.scrollLeft = d.scrollLeft - dx
    }
  }
  const onPointerUp = () => {
    dragRef.current.active = false
  }
  // Swallow the open-click when the gesture was a drag.
  const onClickCapture = (e: React.MouseEvent) => {
    if (dragRef.current.moved > REC_DRAG_THRESHOLD) {
      e.stopPropagation()
      e.preventDefault()
    }
  }

  if (lane.length === 0) {
    return <div className="aspect-square rounded-sm bg-dark/[0.04]" />
  }

  return (
    <div className={clsx("group relative aspect-square overflow-hidden", IMAGE_SHADOW)}>
      <div
        ref={trackRef}
        className="rec-track"
        onScroll={() => setIndex(indexFromScroll())}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
      >
        {lane.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={(e) => {
              const img = e.currentTarget.querySelector("img")
              if (img) onOpen?.(p, img)
            }}
            aria-label={`Open ${p.name}`}
            className="relative block h-full w-full shrink-0"
            style={{ scrollSnapAlign: "start" }}
          >
            <img
              src={p.image}
              alt={p.name}
              draggable={false}
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>

      {/* Cycle arrows - hidden at the ends, surfaced on hover */}
      {lane.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => scrollToIndex(index - 1)}
            aria-label="Previous recommendation"
            className={clsx(
              "absolute top-1/2 left-1.5 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-canvas/90 text-dark shadow-sm backdrop-blur-sm transition-all duration-300 hover:bg-dark hover:text-white",
              index === 0
                ? "pointer-events-none opacity-0"
                : "opacity-0 group-hover:opacity-100",
            )}
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
              <path
                d="M10 3 5 8l5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scrollToIndex(index + 1)}
            aria-label="Next recommendation"
            className={clsx(
              "absolute top-1/2 right-1.5 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-canvas/90 text-dark shadow-sm backdrop-blur-sm transition-all duration-300 hover:bg-dark hover:text-white",
              index === lane.length - 1
                ? "pointer-events-none opacity-0"
                : "opacity-0 group-hover:opacity-100",
            )}
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
              <path
                d="M6 3l5 5-5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Position dots */}
          <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1">
            {lane.map((p, i) => (
              <span
                key={p.id}
                className={clsx(
                  "h-1 rounded-full bg-dark transition-all duration-300",
                  i === index ? "w-3 opacity-80" : "w-1 opacity-25",
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Print size + framing options. Price is a fixed amount per size, plus a flat
// surcharge when framed. "Custom" has no price - it routes to the contact page.
type SizeKey = "8x8" | "12x12" | "16x16"

const SIZE_OPTIONS: { key: SizeKey; label: string }[] = [
  { key: "8x8", label: '8×8"' },
  { key: "12x12", label: '12×12"' },
  { key: "16x16", label: '16×16"' },
]

const SIZE_PRICES: Record<SizeKey, number> = { "8x8": 45, "12x12": 75, "16x16": 120 }
const FRAME_SURCHARGE = 40

// Headline price shown next to each piece's title: the default medium size, framed.
const BASE_PRICE = SIZE_PRICES["12x12"] + FRAME_SURCHARGE

// The soft drop shadow the site's artwork images carry (grid + collection cards).
const IMAGE_SHADOW = "shadow-[0_18px_28px_rgba(0,0,0,0.19)]"

export function FocusWrapper({
  product,
  allProducts,
  onClose,
  onOpenRecommendation,
  solidBackdrop = false,
}: FocusWrapperProps) {
  const transitionNavigate = useTransitionNavigate()
  // The announcement bar (z-1100, root level) renders above the focus wrapper,
  // so when it's live the lightbox close button must drop below it - aligned with
  // the navbar logo/FAB, which the navbar shifts to 3.5rem under the same bar.
  const location = useLocation()
  const announcement = useQuery(api.marketing.activeAnnouncement, {
    route: location.pathname === "/" ? "home" : "other",
  })
  const barActive = !!announcement
  const collectionNameRef = useRef<HTMLHeadingElement>(null)
  const productNameRef = useRef<HTMLParagraphElement>(null)
  const descriptionRef = useRef<HTMLParagraphElement>(null)
  const optionsRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const dividerContainerRef = useRef<HTMLDivElement>(null)
  const galleryOverlayRef = useRef<HTMLDivElement>(null)

  // Product details (description + purchase options) shown below the image.
  const detailsInnerRef = useRef<HTMLDivElement>(null)
  // The whole bottom info/options strip - measured so the image can be sized to
  // always clear it.
  const stripRef = useRef<HTMLDivElement>(null)

  // Gallery
  const imgRefs = useRef<(HTMLDivElement | null)[]>([])
  const currentIdxRef = useRef(0)
  const animatingRef = useRef(false)
  const accDeltaRef = useRef(0)
  const lockedRef = useRef(false)
  const lastWheelTimeRef = useRef(0)
  const galleryActiveRef = useRef(false)
  // Left/right drag (mouse or touch) to advance the gallery.
  const pointerActiveRef = useRef(false)
  const pointerStartXRef = useRef(0)
  const draggedRef = useRef(false)
  const [galleryActive, setGalleryActive] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [hasScrolled, setHasScrolled] = useState(false)

  // Expanded (lightbox) view - current image morphs to a larger, centred
  // position over a white backdrop.
  const [expanded, setExpanded] = useState(false)
  const expandedActiveRef = useRef(false)
  const expandFromRectRef = useRef<DOMRect | null>(null)
  const expandImgRef = useRef<HTMLImageElement>(null)
  const expandOverlayRef = useRef<HTMLDivElement>(null)
  const closeExpandRef = useRef<HTMLButtonElement>(null)

  // Purchase configuration - both must be chosen before adding to cart.
  const [selectedSize, setSelectedSize] = useState<SizeKey | null>(null)
  const [withFrame, setWithFrame] = useState<boolean | null>(null)

  // "Complete your set" upsell panel, revealed after a piece is added to cart.
  const [upsellOpen, setUpsellOpen] = useState(false)
  const upsellRef = useRef<HTMLDivElement>(null)
  // True while the panel is already open, so opening a recommendation is treated
  // as an in-place switch (skip the divider/× re-wipe) rather than a fresh open.
  const prevOpenRef = useRef(false)
  const recLanes = useMemo(
    () => (product ? buildRecommendationLanes(product, allProducts, 3) : [[], [], []]),
    [product, allProducts],
  )

  const isOpen = !!product

  const price =
    selectedSize !== null ? SIZE_PRICES[selectedSize] + (withFrame ? FRAME_SURCHARGE : 0) : null
  const canAddToCart = selectedSize !== null && withFrame !== null

  // "Custom" size can't be priced here - hand off to the contact page with the
  // custom-print inquiry preselected and the artwork name prefilled.
  const handleCustomSize = () => {
    if (!product) return
    transitionNavigate(`/contact?inquiry=custom&product=${encodeURIComponent(product.name)}`)
  }

  const galleryImages: string[] =
    product?.images && product.images.length >= 2
      ? product.images
      : product
        ? Array.from({ length: 5 }, () => product.image)
        : []

  // ── Reset + activate gallery on product open/close ────────────────────────
  useEffect(() => {
    // Any open/close or switch to another piece collapses the upsell panel.
    setUpsellOpen(false)
    if (!isOpen) {
      prevOpenRef.current = false
      galleryActiveRef.current = false
      setGalleryActive(false)
      setCurrentIdx(0)
      setHasScrolled(false)
      currentIdxRef.current = 0
      animatingRef.current = false
      accDeltaRef.current = 0
      lockedRef.current = false
      lastWheelTimeRef.current = 0
      setSelectedSize(null)
      setWithFrame(null)
      expandedActiveRef.current = false
      setExpanded(false)
      return
    }

    currentIdxRef.current = 0
    setCurrentIdx(0)
    setHasScrolled(false)
    animatingRef.current = false
    accDeltaRef.current = 0
    lockedRef.current = false
    lastWheelTimeRef.current = 0
    setSelectedSize(null)
    setWithFrame(null)

    imgRefs.current.forEach((el, i) => {
      if (el) gsap.set(el, { x: 0, display: i === 0 ? "block" : "none" })
    })

    const timer = setTimeout(() => {
      galleryActiveRef.current = true
      setGalleryActive(true)
    }, 1250)
    return () => clearTimeout(timer)
  }, [isOpen, product?.id])

  // ── Slide to next / previous image from the section divider ─────────────
  const navigate = useCallback((dir: 1 | -1) => {
    const total = imgRefs.current.filter(Boolean).length
    const cur = currentIdxRef.current
    const next = cur + dir
    if (next < 0 || next >= total || animatingRef.current) return

    animatingRef.current = true
    lockedRef.current = true
    setHasScrolled(true)

    const curEl = imgRefs.current[cur]
    const nextEl = imgRefs.current[next]
    if (!curEl || !nextEl) {
      animatingRef.current = false
      lockedRef.current = false
      return
    }

    // Slide the images as a tight, edge-to-edge filmstrip: the incoming image's
    // leading edge sits flush against the outgoing image's trailing edge, so the
    // new image swipes in from the right with no background ever showing through
    // the gap. That means the slide distance is exactly one frame width (the
    // overlay clips the overflow to the frame).
    const frameEl = document.getElementById("focus-image-frame")
    const dist = frameEl ? frameEl.offsetWidth : (panelRef.current?.offsetWidth ?? 900)

    // Advance the active dot at the start of the slide so the indicator
    // tracks the image in sync, rather than jumping after the tween ends.
    currentIdxRef.current = next
    setCurrentIdx(next)

    gsap.set(nextEl, { x: dir * dist, display: "block" })
    gsap.to(curEl, { x: -dir * dist, duration: 0.7, ease: "power3.inOut" })
    gsap.to(nextEl, {
      x: 0,
      duration: 0.7,
      ease: "power3.inOut",
      onComplete: () => {
        gsap.set(curEl, { display: "none", x: 0 })
        animatingRef.current = false
        // Brief cooldown after the slide so trailing momentum-scroll can't
        // immediately trigger a second navigation when scrolling hard.
        window.setTimeout(() => {
          lockedRef.current = false
        }, 150)
      },
    })
  }, [])

  // ── Wheel listener ────────────────────────────────────────────────────────
  const onWheel = useCallback(
    (e: WheelEvent) => {
      if (!galleryActiveRef.current) return
      e.preventDefault()

      // While the lightbox is open, swallow wheel input so the gallery beneath
      // it can't slide.
      if (expandedActiveRef.current) {
        accDeltaRef.current = 0
        return
      }

      // While a slide is running (or during its cooldown) swallow wheel input
      // so momentum-scroll can't queue up and skip past images.
      if (animatingRef.current || lockedRef.current) {
        accDeltaRef.current = 0
        return
      }

      // Reset the accumulator after an idle pause so each transition requires a
      // fresh, deliberate scroll gesture rather than leftover momentum.
      const now = performance.now()
      if (now - lastWheelTimeRef.current > 180) accDeltaRef.current = 0
      lastWheelTimeRef.current = now

      // Accept either axis: vertical scroll or a horizontal/trackpad swipe. Use
      // whichever delta dominates this event (down or right = next).
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      accDeltaRef.current += delta
      if (Math.abs(accDeltaRef.current) >= 60) {
        navigate(accDeltaRef.current > 0 ? 1 : -1)
        accDeltaRef.current = 0
      }
    },
    [navigate],
  )

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    panel.addEventListener("wheel", onWheel, { passive: false })
    return () => panel.removeEventListener("wheel", onWheel)
  }, [onWheel])

  // ── Drag to navigate (mouse / touch) ──────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!galleryActiveRef.current || expandedActiveRef.current) return
    pointerActiveRef.current = true
    pointerStartXRef.current = e.clientX
    draggedRef.current = false
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerActiveRef.current) return
    // Past a small threshold this is a drag, not a click - used to suppress the
    // click-to-expand that would otherwise fire on release.
    if (Math.abs(e.clientX - pointerStartXRef.current) > 8) draggedRef.current = true
  }, [])

  const onPointerEnd = useCallback(
    (e: React.PointerEvent) => {
      if (!pointerActiveRef.current) return
      pointerActiveRef.current = false
      const dx = e.clientX - pointerStartXRef.current
      // Swipe left (content moves left) -> next; swipe right -> previous.
      if (Math.abs(dx) >= 50) navigate(dx < 0 ? 1 : -1)
    },
    [navigate],
  )

  // ── Panel entrance animation ──────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    // A switch (panel already open, opening a recommendation) keeps the divider
    // and × in place; only a fresh open wipes them in.
    const isSwitch = prevOpenRef.current
    prevOpenRef.current = true

    gsap.set(panelRef.current, { clipPath: "none" })

    if (!isSwitch) {
      gsap.set(dividerContainerRef.current, { x: "-60vw" })
      gsap.to(dividerContainerRef.current, { x: 0, duration: 1.1, ease: "expo.inOut" })

      gsap.set(closeRef.current, { opacity: 0, scale: 0 })
      gsap.to(closeRef.current, {
        opacity: 1,
        scale: 1,
        duration: 0.35,
        delay: 1.05,
        ease: "back.out(1.7)",
      })
    }

    const textEls = [
      collectionNameRef.current,
      productNameRef.current,
      detailsInnerRef.current,
    ].filter(Boolean) as HTMLElement[]

    gsap.set(textEls, { opacity: 0, y: 14 })

    const tl = gsap.timeline({ delay: 0.6 })
    tl.to(collectionNameRef.current, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, 0)
    tl.to(productNameRef.current, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, 0.15)
    tl.to(detailsInnerRef.current, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, 0.3)

    return () => {
      tl.kill()
    }
  }, [isOpen, product?.id])

  // ── Upsell panel slide + close-button lift ────────────────────────────────
  // The panel rises from the bottom-right and the × lifts from the divider's
  // mid-point (50vh) up to the corner where the divider meets the panel's top
  // edge (20vh). Reversed on close.
  useEffect(() => {
    const panel = upsellRef.current
    const close = closeRef.current
    if (!panel) return
    const liftY = -window.innerHeight * 0.3 // 50vh centre → 20vh panel top
    gsap.killTweensOf(panel)
    if (upsellOpen) {
      gsap.set(panel, { display: "block" })
      gsap.fromTo(panel, { yPercent: 100 }, { yPercent: 0, duration: 0.9, ease: "expo.inOut" })
      if (close) gsap.to(close, { y: liftY, duration: 0.9, ease: "expo.inOut" })
    } else {
      gsap.to(panel, {
        yPercent: 100,
        duration: 0.7,
        ease: "expo.inOut",
        onComplete: () => gsap.set(panel, { display: "none" }),
      })
      if (close) gsap.to(close, { y: 0, duration: 0.7, ease: "expo.inOut" })
    }
  }, [upsellOpen])

  // ── Close ─────────────────────────────────────────────────────────────────
  const handleClose = () => {
    galleryActiveRef.current = false
    animatingRef.current = false
    // Slide the upsell panel back down as part of the close.
    setUpsellOpen(false)

    // Fade text + CTA out immediately so they don't linger during the wipe
    const textEls = [
      collectionNameRef.current,
      productNameRef.current,
      detailsInnerRef.current,
      closeRef.current,
    ].filter(Boolean) as HTMLElement[]
    gsap.to(textEls, { opacity: 0, y: -6, duration: 0.25, stagger: 0.03, ease: "power2.in" })

    const triggerClose = () => {
      // Hide the gallery overlay instantly so the morphing canvas beneath is clean
      gsap.set(galleryOverlayRef.current, { opacity: 0 })
      gsap.set(panelRef.current, { clipPath: "inset(0 0% 0 0)" })
      gsap.to(panelRef.current, {
        clipPath: "inset(0 100% 0 0)",
        duration: 1.1,
        ease: "expo.inOut",
      })
      gsap.to(dividerContainerRef.current, { x: "-60vw", duration: 1.0, ease: "expo.inOut" })
      onClose()
    }

    const idx = currentIdxRef.current
    if (idx === 0) {
      triggerClose()
      return
    }

    // Kill any in-progress slide tweens
    imgRefs.current.forEach((el) => {
      if (el) gsap.killTweensOf(el)
    })

    const frameEl = document.getElementById("focus-image-frame")
    const dist = frameEl ? frameEl.offsetWidth : (panelRef.current?.offsetWidth ?? 900)

    // Lay all images 0..idx out as a filmstrip (same spacing as normal navigation)
    // then animate the whole strip right so image 0 lands at x=0
    for (let i = 0; i <= idx; i++) {
      const el = imgRefs.current[i]
      if (el) gsap.set(el, { x: (i - idx) * dist, display: "block" })
    }

    const strip = imgRefs.current.slice(0, idx + 1).filter((el): el is HTMLDivElement => !!el)

    gsap.to(strip, {
      x: `+=${idx * dist}`,
      duration: 0.55,
      ease: "power3.inOut",
      onComplete: () => {
        imgRefs.current.forEach((el, i) => {
          if (el && i !== 0) gsap.set(el, { display: "none", x: 0 })
        })
        currentIdxRef.current = 0
        setCurrentIdx(0)
        triggerClose()
      },
    })
  }

  // ── Expanded (lightbox) view ──────────────────────────────────────────────
  const openExpanded = () => {
    // A drag that ends on the image shouldn't also open the lightbox.
    if (draggedRef.current) {
      draggedRef.current = false
      return
    }
    if (!galleryActiveRef.current || expandedActiveRef.current) return
    const el = imgRefs.current[currentIdxRef.current]
    if (!el) return
    expandFromRectRef.current = el.getBoundingClientRect()
    expandedActiveRef.current = true
    setExpanded(true)
  }

  const closeExpanded = useCallback(() => {
    const img = expandImgRef.current
    const overlay = expandOverlayRef.current
    // Morph back to wherever the source image now sits in the panel.
    const liveEl = imgRefs.current[currentIdxRef.current]
    const from = liveEl?.getBoundingClientRect() ?? expandFromRectRef.current

    if (!img || !overlay || !from) {
      expandedActiveRef.current = false
      setExpanded(false)
      return
    }

    gsap.killTweensOf(img)
    gsap.to(closeExpandRef.current, { opacity: 0, scale: 0, duration: 0.2, ease: "power2.in" })
    gsap.to(img, {
      left: from.left,
      top: from.top,
      width: from.width,
      height: from.height,
      duration: 0.6,
      ease: "expo.inOut",
    })
    gsap.to(overlay, {
      opacity: 0,
      duration: 0.45,
      delay: 0.15,
      ease: "power2.in",
      onComplete: () => {
        expandedActiveRef.current = false
        setExpanded(false)
      },
    })
  }, [])

  // Morph the image out to a larger, centred position when the lightbox opens.
  useEffect(() => {
    if (!expanded) return
    const from = expandFromRectRef.current
    const img = expandImgRef.current
    const overlay = expandOverlayRef.current
    if (!from || !img || !overlay) return

    const aspect = from.width / from.height
    let w = window.innerWidth * 0.7
    let h = w / aspect
    const maxH = window.innerHeight * 0.82
    if (h > maxH) {
      h = maxH
      w = h * aspect
    }
    const left = (window.innerWidth - w) / 2
    const top = (window.innerHeight - h) / 2

    gsap.set(overlay, { opacity: 0 })
    gsap.to(overlay, { opacity: 1, duration: 0.4, ease: "power2.out" })

    gsap.set(img, {
      position: "fixed",
      margin: 0,
      left: from.left,
      top: from.top,
      width: from.width,
      height: from.height,
    })
    gsap.to(img, { left, top, width: w, height: h, duration: 0.75, ease: "expo.inOut" })

    gsap.set(closeExpandRef.current, { opacity: 0, scale: 0 })
    gsap.to(closeExpandRef.current, {
      opacity: 1,
      scale: 1,
      duration: 0.35,
      delay: 0.5,
      ease: "back.out(1.7)",
    })
  }, [expanded])

  // Escape closes the lightbox.
  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeExpanded()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [expanded, closeExpanded])

  // ── Keep the image clear of the bottom strip ──────────────────────────────
  // The open-morph in the home page sizes the image from an estimated bottom
  // reserve. Once the panel has rendered its real info/options strip we measure
  // it and resize the image so there is always a clean gap above the strip -
  // for any artwork aspect ratio, strip content, or viewport size.
  const fitImageToStrip = useCallback(() => {
    const frame = document.getElementById("focus-image-frame")
    const strip = stripRef.current
    if (!frame || !strip) return

    const aspect = frame.offsetWidth / frame.offsetHeight
    const isMd = window.innerWidth >= 768
    const titleTop = isMd ? 96 : 64
    const titleFont = Math.min(Math.max(window.innerWidth * 0.07, 48), 96)
    const topReserve = titleTop + titleFont + 22

    // The strip is anchored at bottom-8 (32px); keep a gap above it.
    const STRIP_OFFSET = 32
    const GAP = 28
    const bottomReserve = strip.offsetHeight + STRIP_OFFSET + GAP

    const maxW = Math.min(window.innerWidth * 0.36, 440)
    const maxH = Math.max(window.innerHeight - topReserve - bottomReserve, 160)
    let tw = maxW
    let th = tw / aspect
    if (th > maxH) {
      th = maxH
      tw = th * aspect
    }
    gsap.to(frame, {
      width: tw,
      height: th,
      top: topReserve,
      bottom: bottomReserve,
      duration: 0.4,
      ease: "expo.inOut",
    })
  }, [])

  useEffect(() => {
    if (!isOpen) return
    // Run after the open-morph has settled the image into the slot, so resizing
    // the frame carries the image with it rather than fighting the morph.
    const t = window.setTimeout(fitImageToStrip, 1200)
    window.addEventListener("resize", fitImageToStrip)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener("resize", fitImageToStrip)
    }
  }, [isOpen, product?.id, fitImageToStrip])

  const expandedSrc = galleryImages[currentIdx] ?? product?.image ?? ""
  const expandFrom = expandFromRectRef.current

  return (
    <div className={clsx("focus-wrapper", isOpen && "active")}>
      {/* Left panel - 60vw. Transparent by default so the home canvas slide-away
          morph shows through; opaque only when opening over static page content. */}
      <div
        ref={panelRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerLeave={onPointerEnd}
        className={clsx("absolute inset-y-0 left-0 overflow-hidden", solidBackdrop && "bg-canvas")}
        style={{ width: "60vw", visibility: isOpen ? "visible" : "hidden" }}
      >
        {/* Collection name - top left */}
        <h2
          ref={collectionNameRef}
          className="pointer-events-none absolute top-16 left-6 z-20 leading-none font-medium text-dark md:top-24 md:left-10"
          style={{ fontSize: "clamp(3rem, 7vw, 6rem)", letterSpacing: "-0.04em", opacity: 0 }}
        >
          {product?.collectionName}
        </h2>

        {/* Image area */}
        <div id="focus-image-frame" className="absolute" style={{ inset: 0, margin: "auto" }}>
          <div id="focus-image-slot" className="pointer-events-none absolute inset-0 z-[1]" />

          {/* Gallery overlay - fades in after morph, canvas bg fills the gap between sliding images */}
          {isOpen && (
            <div
              ref={galleryOverlayRef}
              className="absolute inset-0 z-[2]"
              style={{
                backgroundColor: "#f0ede6",
                opacity: galleryActive ? 1 : 0,
                transition: "opacity 0.35s ease",
                pointerEvents: "none",
                // Clip the sliding images to the frame so a swipe stays within the
                // image rectangle - no image spills over the panel background.
                overflow: "hidden",
              }}
            >
              {galleryImages.map((src, i) => (
                <div
                  key={`${product?.id}-${i}`}
                  ref={(el) => {
                    imgRefs.current[i] = el
                  }}
                  className="absolute inset-0"
                  style={{ display: i === 0 ? "block" : "none" }}
                >
                  <img
                    src={src}
                    alt={product?.name ?? ""}
                    draggable={false}
                    className="pointer-events-none h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Hover affordance - click the image to open the expanded view */}
          {galleryActive && (
            <button
              type="button"
              onClick={openExpanded}
              aria-label="Expand image"
              className="group absolute inset-0 z-[3] flex cursor-none items-center justify-center"
            >
              <span className="flex h-14 w-14 scale-90 items-center justify-center rounded-full bg-dark/65 text-light opacity-0 backdrop-blur-sm transition-all duration-300 ease-out group-hover:scale-100 group-hover:opacity-100">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4" />
                </svg>
              </span>
            </button>
          )}
        </div>

        {/* Bottom strip - gallery indicator + title + details */}
        <div ref={stripRef} className="absolute inset-x-6 bottom-8 z-20 md:inset-x-10">
          {/* Gallery indicator + title */}
          <div className="min-w-0">
            <div
              className="mb-3 flex items-center gap-3"
              style={{ opacity: galleryActive ? 1 : 0, transition: "opacity 0.4s ease" }}
            >
              <div className="flex items-center gap-1.5">
                {galleryImages.map((_, i) => (
                  <div
                    key={i}
                    className={clsx(
                      "rounded-full bg-dark transition-all duration-700 ease-out",
                      i === currentIdx ? "h-1.5 w-5" : "h-1.5 w-1.5 opacity-20",
                    )}
                  />
                ))}
              </div>
              <span
                className="flex items-center gap-1.5 text-[10px] font-medium tracking-widest text-dark/60 uppercase transition-opacity duration-500"
                style={{ opacity: hasScrolled ? 0 : 1 }}
              >
                Scroll to explore
                <svg
                  viewBox="0 0 16 8"
                  fill="none"
                  className="scroll-hint-arrow h-2 w-4 text-dark/60"
                  aria-hidden="true"
                >
                  <path
                    d="M1 4h13M11 1l3 3-3 3"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
            <p
              ref={productNameRef}
              className="flex items-baseline gap-2 text-sm font-medium text-dark"
              style={{ opacity: 0 }}
            >
              <span>{product?.name}</span>
              <span className="text-dark/45">${BASE_PRICE}</span>
            </p>
          </div>

          {/* Details - description, options, explore collection */}
          <div ref={detailsInnerRef} className="flex items-end justify-between gap-6 pt-5">
            {/* Left: description + explore collection */}
            <div className="min-w-0">
              <p
                ref={descriptionRef}
                className="text-xs leading-relaxed text-dark/55"
                style={{ maxWidth: "44ch" }}
              >
                {product?.description}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (!product) return
                  emitPopupAction("collection")
                  transitionNavigate(`/collection/${product.collectionSlug}`)
                }}
                className="group mt-4 inline-flex items-center gap-1.5 rounded-lg border border-dark/20 px-3.5 py-2 text-[11px] font-medium text-dark transition-colors hover:border-dark/40"
              >
                <HoverLabel>Explore collection</HoverLabel>
                <span className="transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </button>
            </div>

            {/* Right: size row → frame + cart row */}
            <div ref={optionsRef} className="flex flex-shrink-0 flex-col items-start gap-1.5">
              {/* Size */}
              <div className="flex items-center gap-1">
                {SIZE_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setSelectedSize(key)}
                    aria-pressed={selectedSize === key}
                    className={clsx(
                      "group rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                      selectedSize === key
                        ? "border-dark bg-dark text-white"
                        : "border-dark/20 text-dark hover:border-dark/40",
                    )}
                  >
                    <HoverLabel>{label}</HoverLabel>
                  </button>
                ))}
                <button
                  onClick={handleCustomSize}
                  className="group rounded-lg border border-dark/20 px-2.5 py-1.5 text-[11px] font-medium text-dark transition-colors hover:border-dark/40"
                >
                  <HoverLabel>Custom</HoverLabel>
                </button>
              </div>

              {/* Frame toggle + Add to Cart */}
              <div className="flex items-center gap-1">
                {(
                  [
                    { value: true, label: "Framed" },
                    { value: false, label: "Unframed" },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={label}
                    onClick={() => setWithFrame(value)}
                    aria-pressed={withFrame === value}
                    className={clsx(
                      "group rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                      withFrame === value
                        ? "border-dark bg-dark text-white"
                        : "border-dark/20 text-dark hover:border-dark/40",
                    )}
                  >
                    <HoverLabel>{label}</HoverLabel>
                  </button>
                ))}
                <button
                  disabled={!canAddToCart}
                  onClick={(e) => {
                    e.preventDefault()
                    if (canAddToCart) setUpsellOpen(true)
                  }}
                  className={clsx(
                    "group ml-1 rounded-lg px-3 py-1.5 text-[11px] font-medium tracking-wide transition-all",
                    canAddToCart
                      ? "bg-dark text-white hover:opacity-70"
                      : "cursor-not-allowed bg-dark/20 text-dark/40",
                  )}
                >
                  <HoverLabel>
                    {canAddToCart ? `Add to Cart · $${price} →` : "Add to Cart →"}
                  </HoverLabel>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Click the exposed canvas to the right of the panel to close (same as ×) */}
      {isOpen && (
        <button
          type="button"
          onClick={handleClose}
          aria-label="Back to canvas"
          className="absolute inset-y-0 right-0 cursor-none"
          style={{ left: "60vw" }}
        />
      )}

      {/* "Complete your set" upsell panel - rises from the bottom-right after a
          piece is added to cart. No z-index: DOM order keeps it above the
          close-on-click area yet below the divider/× that follow it. */}
      {isOpen && (
        <div
          ref={upsellRef}
          className="absolute right-0 border-t border-dark/20 bg-canvas"
          style={{ left: "60vw", top: "20vh", bottom: 0, display: "none" }}
        >
          <div className="flex h-full flex-col px-6 py-7 md:px-9">
            {/* Top center: continue shopping - dismisses the panel, cart kept */}
            <div className="mb-6 flex justify-center">
              <button
                type="button"
                onClick={() => setUpsellOpen(false)}
                aria-label="Continue shopping"
                className="group flex items-center gap-2 rounded-full border border-dark/20 bg-canvas px-4 py-2 text-[11px] font-medium tracking-wide text-dark transition-colors duration-300 hover:border-dark/40 hover:bg-dark hover:text-white"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                    <path
                      d="M2.5 3.5H5l1.8 9.2a1.2 1.2 0 0 0 1.18.95h7.3a1.2 1.2 0 0 0 1.17-.9l1.45-5.6H6.2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="9" cy="19" r="1.4" fill="currentColor" />
                    <circle cx="16" cy="19" r="1.4" fill="currentColor" />
                  </svg>
                </span>
                <HoverLabel>Continue shopping · cart updated</HoverLabel>
              </button>
            </div>

            <div className="mx-auto flex w-full max-w-[22rem] flex-1 flex-col">
              <p className="mb-5 text-[10px] font-medium tracking-widest text-dark/50 uppercase">
                Complete your set
              </p>

              <div className="grid grid-cols-2 gap-4">
                {/* Slot 1 - the piece just added to the cart */}
                <div className={clsx("relative aspect-square overflow-hidden", IMAGE_SHADOW)}>
                  {product && (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  )}
                  <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-dark text-white">
                    <svg
                      viewBox="0 0 12 12"
                      fill="none"
                      className="h-2.5 w-2.5"
                      aria-hidden="true"
                    >
                      <path
                        d="M2 6.2 4.6 9 10 3"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>

                {/* Slots 2-4 - recommendation carousels (distinct lanes) */}
                {recLanes.map((lane, i) => (
                  <RecommendationSlot
                    key={lane[0]?.id ?? `lane-${i}`}
                    lane={lane}
                    onOpen={onOpenRecommendation}
                  />
                ))}
              </div>

              <div className="mt-auto pt-7">
                <button
                  type="button"
                  onClick={(e) => e.preventDefault()}
                  className="group flex w-full items-center justify-center rounded-lg bg-dark px-5 py-3.5 text-sm font-medium text-white transition-opacity duration-300 hover:opacity-80"
                >
                  <HoverLabel>Proceed to checkout</HoverLabel>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Divider line + × button */}
      {isOpen && (
        <div
          ref={dividerContainerRef}
          className="absolute inset-y-0"
          style={{ left: "60vw", transform: "translateX(-60vw)" }}
        >
          <div
            className="absolute inset-y-0 flex flex-col items-center justify-center"
            style={{ transform: "translateX(-50%)" }}
          >
            <div className="h-full w-px bg-dark/15" />
            <button
              ref={closeRef}
              onClick={handleClose}
              className="absolute flex h-10 w-10 items-center justify-center rounded-none border border-dark/20 bg-[#f0ede6] text-dark transition-all duration-300 hover:rounded-lg hover:bg-dark hover:text-white"
              style={{ opacity: 0, transform: "scale(0)" }}
              aria-label="Close"
            >
              <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
                <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" />
                <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Expanded (lightbox) view */}
      {expanded && (
        <div
          ref={expandOverlayRef}
          className="fixed inset-0 z-[2000] bg-white"
          style={{ opacity: 0 }}
        >
          {/* Backdrop - click anywhere outside to close */}
          <button
            type="button"
            onClick={closeExpanded}
            aria-label="Close expanded image"
            className="absolute inset-0 z-[1] cursor-none"
          />
          <button
            ref={closeExpandRef}
            type="button"
            onClick={closeExpanded}
            aria-label="Close expanded image"
            className="absolute top-6 right-6 z-[3] flex h-11 w-11 items-center justify-center rounded-none border border-dark/20 bg-white text-dark transition-all duration-300 hover:rounded-lg hover:bg-dark hover:text-white md:top-8 md:right-8"
            style={barActive ? { opacity: 0, top: "3.5rem" } : { opacity: 0 }}
          >
            <svg viewBox="0 0 12 12" fill="none" className="h-3.5 w-3.5">
              <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" />
              <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <img
            ref={expandImgRef}
            src={expandedSrc}
            alt={product?.name ?? ""}
            draggable={false}
            className="pointer-events-none object-cover"
            style={
              expandFrom
                ? {
                    position: "fixed",
                    margin: 0,
                    left: expandFrom.left,
                    top: expandFrom.top,
                    width: expandFrom.width,
                    height: expandFrom.height,
                  }
                : { opacity: 0 }
            }
          />
        </div>
      )}
    </div>
  )
}
