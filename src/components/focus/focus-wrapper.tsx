import { clsx } from "clsx"
import { useCallback, useEffect, useRef, useState } from "react"
import { gsap } from "../../lib/gsap"
import type { Product } from "../../lib/types"

interface FocusWrapperProps {
  product: Product | null
  allProducts: Product[]
  onClose: () => void
}

export function FocusWrapper({ product, allProducts: _allProducts, onClose }: FocusWrapperProps) {
  const collectionNameRef = useRef<HTMLHeadingElement>(null)
  const productNameRef = useRef<HTMLParagraphElement>(null)
  const descriptionRef = useRef<HTMLParagraphElement>(null)
  const priceRef = useRef<HTMLParagraphElement>(null)
  const ctaRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const dividerContainerRef = useRef<HTMLDivElement>(null)
  const galleryOverlayRef = useRef<HTMLDivElement>(null)

  // Gallery
  const imgRefs = useRef<(HTMLDivElement | null)[]>([])
  const currentIdxRef = useRef(0)
  const animatingRef = useRef(false)
  const accDeltaRef = useRef(0)
  const lockedRef = useRef(false)
  const lastWheelTimeRef = useRef(0)
  const galleryActiveRef = useRef(false)
  const [galleryActive, setGalleryActive] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [hasScrolled, setHasScrolled] = useState(false)

  const isOpen = !!product

  const galleryImages: string[] =
    product?.images && product.images.length >= 2
      ? product.images
      : product
        ? Array.from({ length: 5 }, () => product.image)
        : []

  // ── Reset + activate gallery on product open/close ────────────────────────
  useEffect(() => {
    if (!isOpen) {
      galleryActiveRef.current = false
      setGalleryActive(false)
      setCurrentIdx(0)
      setHasScrolled(false)
      currentIdxRef.current = 0
      animatingRef.current = false
      accDeltaRef.current = 0
      lockedRef.current = false
      lastWheelTimeRef.current = 0
      return
    }

    currentIdxRef.current = 0
    setCurrentIdx(0)
    setHasScrolled(false)
    animatingRef.current = false
    accDeltaRef.current = 0
    lockedRef.current = false
    lastWheelTimeRef.current = 0

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

    // Distance from the image frame's centre to the panel edge (= divider).
    // Frame is centred in the panel, so:  dist = (panelWidth + frameWidth) / 2
    // This places the incoming image's leading edge exactly at the divider,
    // and the outgoing image's trailing edge exactly at the panel's far side.
    const frameEl = document.getElementById("focus-image-frame")
    const panelEl = panelRef.current
    const dist =
      frameEl && panelEl
        ? (panelEl.offsetWidth + frameEl.offsetWidth) / 2
        : (panelRef.current?.offsetWidth ?? 900)

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

      accDeltaRef.current += e.deltaY
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

  // ── Panel entrance animation ──────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return

    gsap.set(panelRef.current, { clipPath: "none" })

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

    const textEls = [
      collectionNameRef.current,
      productNameRef.current,
      descriptionRef.current,
      priceRef.current,
      ctaRef.current,
    ].filter(Boolean) as HTMLElement[]

    gsap.set(textEls, { opacity: 0, y: 14 })

    const tl = gsap.timeline({ delay: 0.6 })
    tl.to(collectionNameRef.current, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, 0)
    tl.to(productNameRef.current, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, 0.15)
    tl.to(descriptionRef.current, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, 0.25)
    tl.to(priceRef.current, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, 0.35)
    tl.to(ctaRef.current, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, 0.45)

    return () => {
      tl.kill()
    }
  }, [isOpen, product?.id])

  // ── Close ─────────────────────────────────────────────────────────────────
  const handleClose = () => {
    galleryActiveRef.current = false
    animatingRef.current = false

    // Fade text + CTA out immediately so they don't linger during the wipe
    const textEls = [
      collectionNameRef.current,
      productNameRef.current,
      descriptionRef.current,
      priceRef.current,
      ctaRef.current,
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
    const panelEl = panelRef.current
    const dist = frameEl && panelEl ? (panelEl.offsetWidth + frameEl.offsetWidth) / 2 : 900

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

  return (
    <div className={clsx("focus-wrapper", isOpen && "active")}>
      {/* Left panel — 60vw */}
      <div
        ref={panelRef}
        className="absolute inset-y-0 left-0 overflow-hidden"
        style={{ width: "60vw", visibility: isOpen ? "visible" : "hidden" }}
      >
        {/* Collection name — top left */}
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

          {/* Gallery overlay — fades in after morph, canvas bg fills the gap between sliding images */}
          {isOpen && (
            <div
              ref={galleryOverlayRef}
              className="absolute inset-0 z-[2]"
              style={{
                backgroundColor: "#f0ede6",
                opacity: galleryActive ? 1 : 0,
                transition: "opacity 0.35s ease",
                pointerEvents: "none",
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
        </div>

        {/* Bottom info — dots, scroll hint, product text */}
        <div className="absolute bottom-8 left-6 z-20 md:left-10">
          <div
            className="mb-4 flex items-center gap-3"
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

          <p ref={productNameRef} className="text-sm font-medium text-dark" style={{ opacity: 0 }}>
            {product?.name}
          </p>
          <p
            ref={descriptionRef}
            className="mt-1 text-xs leading-relaxed text-dark/50"
            style={{ opacity: 0, maxWidth: "38ch" }}
          >
            {product?.description}
          </p>
          <p ref={priceRef} className="mt-2 text-xs text-dark/40" style={{ opacity: 0 }}>
            ∅ {product?.size} · ${product?.price}
          </p>
        </div>

        {/* Add to Cart — bottom right */}
        <button
          ref={ctaRef}
          className="absolute right-8 bottom-8 z-20 flex items-center gap-2 rounded-lg bg-dark px-5 py-3 text-xs font-medium tracking-widest text-white uppercase transition-opacity hover:opacity-70"
          style={{ opacity: 0 }}
          onClick={(e) => e.preventDefault()}
        >
          Add to Cart <span>→</span>
        </button>
      </div>

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
              className="absolute flex h-10 w-10 items-center justify-center border border-dark/20 bg-[#f0ede6] text-dark transition-colors hover:bg-dark hover:text-white"
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
    </div>
  )
}
