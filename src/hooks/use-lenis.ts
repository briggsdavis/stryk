import Lenis from "lenis"
import { type RefObject, useEffect, useRef } from "react"
import { ScrollTrigger } from "../lib/gsap"

export function useLenis(enabled = true, wrapperRef?: RefObject<HTMLElement | null>) {
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    if (!enabled) return

    const wrapper = wrapperRef?.current ?? undefined
    const content = wrapper
      ? ((wrapper.firstElementChild as HTMLElement | undefined) ?? undefined)
      : undefined

    const lenis = new Lenis({
      lerp: 0.1,
      wheelMultiplier: 0.7,
      ...(wrapper ? { wrapper, content } : {}),
    })
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
  }, [enabled, wrapperRef])

  return lenisRef
}
