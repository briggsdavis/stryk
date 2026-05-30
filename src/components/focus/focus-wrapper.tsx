import { clsx } from "clsx"
import { useEffect, useRef, useState } from "react"
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
  // Outer wrapper for GSAP x animation (no centering transform so GSAP doesn't conflict)
  const dividerContainerRef = useRef<HTMLDivElement>(null)
  const overlay1Ref = useRef<HTMLDivElement>(null)
  const overlay2Ref = useRef<HTMLDivElement>(null)

  const [carouselIdx, setCarouselIdx] = useState(0)

  const isOpen = !!product

  useEffect(() => {
    setCarouselIdx(0)
  }, [product?.id])

  useEffect(() => {
    if (!isOpen) return

    // Reset any leftover clip from previous close
    gsap.set(panelRef.current, { clipPath: "none" })

    // --- Divider + × button: slides right with canvas ---
    gsap.set(dividerContainerRef.current, { x: "-60vw" })
    gsap.to(dividerContainerRef.current, { x: 0, duration: 1.1, ease: "expo.inOut" })

    // --- × button: pops in when divider arrives ---
    gsap.set(closeRef.current, { opacity: 0, scale: 0 })
    gsap.to(closeRef.current, {
      opacity: 1,
      scale: 1,
      duration: 0.35,
      delay: 1.05,
      ease: "back.out(1.7)",
    })

    // --- Staggered text fade-in (starts while Flip is still in flight) ---
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

  // Vertical wheel → horizontal carousel
  useEffect(() => {
    const el = panelRef.current
    if (!el || !isOpen) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.deltaY > 0) setCarouselIdx((p) => Math.min(p + 1, 2))
      else setCarouselIdx((p) => Math.max(p - 1, 0))
    }

    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [isOpen])

  const handleClose = () => {
    // Wipe panel right-to-left in sync with canvas sliding back
    gsap.set(panelRef.current, { clipPath: "inset(0 0% 0 0)" })
    gsap.to(panelRef.current, { clipPath: "inset(0 100% 0 0)", duration: 1.1, ease: "expo.inOut" })

    // Slide × button + divider back left with canvas
    gsap.to(dividerContainerRef.current, { x: "-60vw", duration: 1.0, ease: "expo.inOut" })

    // Reset carousel overlays instantly
    if (overlay1Ref.current) {
      overlay1Ref.current.style.transition = "none"
      overlay1Ref.current.style.transform = "translateX(101%)"
    }
    if (overlay2Ref.current) {
      overlay2Ref.current.style.transition = "none"
      overlay2Ref.current.style.transform = "translateX(101%)"
    }
    setCarouselIdx(0)
    onClose()
  }

  return (
    <div className={clsx("focus-wrapper", isOpen && "active")}>
      {/* Left panel — 60vw */}
      <div
        ref={panelRef}
        className="absolute inset-y-0 left-0"
        style={{ width: "60vw", visibility: isOpen ? "visible" : "hidden" }}
      >
        {/* Collection name — top left */}
        <h2
          ref={collectionNameRef}
          className="pointer-events-none absolute top-6 left-6 z-20 leading-none font-medium text-dark md:top-8 md:left-10"
          style={{ fontSize: "clamp(3rem, 7vw, 6rem)", letterSpacing: "-0.04em", opacity: 0 }}
        >
          {product?.collectionName}
        </h2>

        {/* Image area — centered in the left panel (inset:0 + margin:auto). Its
           width/height are set imperatively per-click to match the clicked
           image's exact aspect ratio, so the morph is a pure scale (no crop or
           aspect change). Width/height are intentionally NOT in this style object
           so React never overwrites the per-click sizing. */}
        <div
          id="focus-image-frame"
          className="absolute overflow-hidden"
          style={{ inset: 0, margin: "auto" }}
        >
          {/* Flip element lands here and fills via CSS (#focus-image-slot > * rule) */}
          <div id="focus-image-slot" className="pointer-events-none absolute inset-0 z-[1]" />

          {/* Carousel image 2 */}
          {product?.images?.[1] && (
            <div
              ref={overlay1Ref}
              className="absolute inset-0 z-[2]"
              style={{
                transform: carouselIdx >= 1 ? "translateX(0)" : "translateX(101%)",
                transition: "transform 0.6s cubic-bezier(0.625, 0.05, 0, 1)",
              }}
            >
              <img src={product.images[1]} alt="" className="h-full w-full object-cover" />
            </div>
          )}

          {/* Carousel image 3 */}
          {product?.images?.[2] && (
            <div
              ref={overlay2Ref}
              className="absolute inset-0 z-[2]"
              style={{
                transform: carouselIdx >= 2 ? "translateX(0)" : "translateX(101%)",
                transition: "transform 0.6s cubic-bezier(0.625, 0.05, 0, 1)",
              }}
            >
              <img src={product.images[2]} alt="" className="h-full w-full object-cover" />
            </div>
          )}

          {/* Carousel dots */}
          <div className="absolute bottom-3 left-1/2 z-[3] flex -translate-x-1/2 gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={clsx(
                  "h-1 w-1 rounded-full transition-all duration-300",
                  i === carouselIdx ? "scale-125 bg-white" : "bg-white/50",
                )}
              />
            ))}
          </div>
        </div>

        {/* Product name, description, price — bottom left */}
        <div className="absolute bottom-8 left-6 z-20 md:left-10">
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
          className="absolute right-8 bottom-8 z-20 flex items-center gap-2 bg-dark px-5 py-3 text-xs font-medium tracking-widest text-white uppercase transition-opacity hover:opacity-70"
          style={{ opacity: 0 }}
          onClick={(e) => e.preventDefault()}
        >
          Add to Cart <span>→</span>
        </button>
      </div>

      {/* Divider line + × button — slides right with canvas via GSAP x animation */}
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
