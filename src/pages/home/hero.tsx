import { useEffect, useRef } from "react"
import { HoverLabel } from "../../components/ui/hover-label"
import { gsap, SplitText } from "../../lib/gsap"

export function Hero() {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const subRef = useRef<HTMLParagraphElement>(null)
  const ctasRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const tl = gsap.timeline({ delay: 2.8 })

    if (headingRef.current) {
      const split = new SplitText(headingRef.current, { type: "lines" })
      gsap.set(headingRef.current, { overflow: "hidden" })
      gsap.set(split.lines, { yPercent: 110 })
      tl.to(split.lines, { yPercent: 0, duration: 1, ease: "power3.out", stagger: 0.08 }, 0)
    }

    if (subRef.current)
      tl.fromTo(
        subRef.current,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" },
        0.4,
      )

    if (ctasRef.current)
      tl.fromTo(
        ctasRef.current,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" },
        0.6,
      )

    if (hintRef.current)
      tl.fromTo(
        hintRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.8, ease: "power2.out" },
        1,
      )

    return () => {
      tl.kill()
    }
  }, [])

  return (
    <div className="pointer-events-none absolute right-8 bottom-12 left-8 z-10 md:right-16 md:left-16">
      <h1 ref={headingRef} className="text-160 mb-6 max-w-4xl font-medium">
        Explore Stryk collections
      </h1>
      <p ref={subRef} className="text-18 mb-8 max-w-sm text-light/60" style={{ opacity: 0 }}>
        Thoughtfully crafted dinnerware for moments worth remembering.
      </p>
      <div ref={ctasRef} className="pointer-events-auto flex gap-4" style={{ opacity: 0 }}>
        <button type="button" className="btn-filled group">
          <HoverLabel>Shop Now</HoverLabel>
          <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </button>
        <button type="button" className="btn-outline group">
          <HoverLabel>View Collection</HoverLabel>
        </button>
      </div>
      <p
        ref={hintRef}
        className="pointer-events-none mt-8 text-xs font-medium tracking-widest text-light/30 uppercase"
        style={{ opacity: 0 }}
      >
        Drag to explore
      </p>
    </div>
  )
}
