import Lenis from "lenis"
import { useEffect, useRef } from "react"
import { ScrollTrigger } from "../lib/gsap"

export function useLenis(enabled = true) {
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    if (!enabled) return

    const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.7 })
    lenisRef.current = lenis

    lenis.on("scroll", ScrollTrigger.update)

    let raf: number
    function tick(time: number) {
      lenis.raf(time)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [enabled])

  return lenisRef
}
