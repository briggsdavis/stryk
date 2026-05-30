import { useEffect, useRef } from "react"
import { gsap } from "../../lib/gsap"

interface IntroScreenProps {
  onComplete: () => void
}

export function IntroScreen({ onComplete }: IntroScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wordRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    // Dev shortcut: ?skip skips the intro
    if (new URLSearchParams(window.location.search).has("skip")) {
      onComplete()
      return
    }

    const container = containerRef.current
    const word = wordRef.current
    if (!container || !word) return

    gsap.set(word, { opacity: 0, x: -24 })

    const tl = gsap.timeline()

    // Word slides in left→right and fades in as one unit
    tl.to(word, { opacity: 1, x: 0, duration: 0.7, ease: "power3.out" })

    // Hold
    tl.to({}, { duration: 0.5 })

    // Fade out
    tl.to(word, { opacity: 0, x: 16, duration: 0.4, ease: "power2.in" })

    // Fade container
    tl.to(container, {
      opacity: 0,
      duration: 0.35,
      ease: "power2.inOut",
      onComplete,
    })

    return () => { tl.kill() }
  }, [onComplete])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-white"
    >
      <span
        ref={wordRef}
        className="font-medium tracking-[0.15em] text-black"
        style={{ fontSize: "clamp(1.1rem, 2vw, 1.6rem)", opacity: 0 }}
      >
        STRYK
      </span>
    </div>
  )
}
