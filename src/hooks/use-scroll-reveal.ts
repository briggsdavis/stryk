import { useEffect, useRef } from "react"
import { gsap, ScrollTrigger, SplitText } from "../lib/gsap"

export function useImageReveal() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const maskRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const mask = maskRef.current
    if (!wrap || !mask) return

    const trigger = ScrollTrigger.create({
      trigger: wrap,
      start: "top 80%",
      onEnter: () => {
        gsap.to(mask, { yPercent: -100, duration: 1.2, ease: "power3.inOut" })
      },
    })

    return () => trigger.kill()
  }, [])

  return { wrapRef, maskRef }
}

export function useSplitReveal(ref: React.RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const split = new SplitText(el, { type: "lines" })
    gsap.set(el, { overflow: "hidden" })
    gsap.set(split.lines, { yPercent: 110 })

    const trigger = ScrollTrigger.create({
      trigger: el,
      start: "top 88%",
      onEnter: () => {
        gsap.to(split.lines, {
          yPercent: 0,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.06,
        })
      },
    })

    return () => {
      trigger.kill()
      split.revert()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
