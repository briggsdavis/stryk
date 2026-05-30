import { useCallback, useEffect, useRef, useState } from "react"
import { Draggable, gsap } from "../lib/gsap"
import type { ZoomLevel } from "../lib/types"

const ZOOM_CONFIGS: Record<ZoomLevel, { scale: number; wFactor: number; hFactor: number }> = {
  2: { scale: 1.0, wFactor: 1, hFactor: 1 },
  1: { scale: 0.6, wFactor: 1.67, hFactor: 1.67 },
  0: { scale: 0.35, wFactor: 2.86, hFactor: 2.86 },
}

export function useXpCanvas(active: boolean) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const collectionRef = useRef<HTMLDivElement>(null)
  const draggableRef = useRef<Draggable[]>([])
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(2)
  const zoomRef = useRef<ZoomLevel>(2)

  // smooth pan via lerp
  const scrollDeltaRef = useRef({ x: 0, y: 0 })
  const positionRef = useRef({ x: 0, y: 0 })
  const targetRef = useRef({ x: 0, y: 0 })
  const rafRef = useRef<number>(0)
  const xSet = useRef<((v: number) => void) | null>(null)
  const ySet = useRef<((v: number) => void) | null>(null)

  const getBounds = useCallback(() => {
    const wrapper = wrapperRef.current
    const collection = collectionRef.current
    if (!wrapper || !collection) return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
    const ww = wrapper.offsetWidth
    const wh = wrapper.offsetHeight
    const cw = collection.scrollWidth
    const ch = collection.scrollHeight
    return {
      minX: Math.min(0, ww - cw - 80),
      maxX: 80,
      minY: Math.min(0, wh - ch - 80),
      maxY: 80,
    }
  }, [])

  const clamp = useCallback(
    (x: number, y: number) => {
      const b = getBounds()
      return {
        x: Math.max(b.minX, Math.min(b.maxX, x)),
        y: Math.max(b.minY, Math.min(b.maxY, y)),
      }
    },
    [getBounds],
  )

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t

  const tick = useCallback(() => {
    const dx = targetRef.current.x - positionRef.current.x
    const dy = targetRef.current.y - positionRef.current.y

    if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) return

    const next = {
      x: lerp(positionRef.current.x, targetRef.current.x, 0.085),
      y: lerp(positionRef.current.y, targetRef.current.y, 0.085),
    }
    positionRef.current = next
    xSet.current?.(next.x)
    ySet.current?.(next.y)
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const onWheel = useCallback(
    (e: WheelEvent) => {
      if (!active) return
      e.preventDefault()
      const next = clamp(
        targetRef.current.x - e.deltaX * 0.7,
        targetRef.current.y - e.deltaY * 0.7,
      )
      targetRef.current = next
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(tick)
    },
    [active, clamp, tick],
  )

  const initDraggable = useCallback(() => {
    const collection = collectionRef.current
    if (!collection) return
    draggableRef.current.forEach((d) => d.kill())

    const b = getBounds()
    draggableRef.current = Draggable.create(collection, {
      type: "x,y",
      inertia: true,
      throwResistance: 6000,
      edgeResistance: 0.9,
      bounds: { minX: b.minX, maxX: b.maxX, minY: b.minY, maxY: b.maxY },
      onDrag() {
        positionRef.current = { x: this.x, y: this.y }
        targetRef.current = { x: this.x, y: this.y }
      },
      onThrowUpdate() {
        positionRef.current = { x: this.x, y: this.y }
        targetRef.current = { x: this.x, y: this.y }
      },
    })
  }, [getBounds])

  const applyZoom = useCallback(
    (level: ZoomLevel) => {
      const wrapper = wrapperRef.current
      if (!wrapper) return
      const cfg = ZOOM_CONFIGS[level]
      gsap.to(wrapper, {
        scale: cfg.scale,
        width: `${cfg.wFactor * 100}vw`,
        height: `${cfg.hFactor * 100}vh`,
        duration: 1.5,
        ease: "expo.inOut",
        onComplete: initDraggable,
      })
    },
    [initDraggable],
  )

  const zoomIn = useCallback(() => {
    if (zoomRef.current >= 2) return
    const next = (zoomRef.current + 1) as ZoomLevel
    zoomRef.current = next
    setZoomLevel(next)
    applyZoom(next)
  }, [applyZoom])

  const zoomOut = useCallback(() => {
    if (zoomRef.current <= 0) return
    const next = (zoomRef.current - 1) as ZoomLevel
    zoomRef.current = next
    setZoomLevel(next)
    applyZoom(next)
  }, [applyZoom])

  // Called by HomePage after intro completes — starts the polka-dot pop-in then zoom
  const runEntrance = useCallback(() => {
    const wrapper = wrapperRef.current
    const collection = collectionRef.current
    if (!wrapper || !collection) return

    const items = collection.querySelectorAll<HTMLElement>(".xp-item")

    // Start zoomed out a bit
    gsap.set(wrapper, { scale: 0.8, transformOrigin: "center center" })

    // Randomise the order for the pop-in
    const shuffled = [...items].sort(() => Math.random() - 0.5)

    // Pop in one by one, quickly
    gsap.to(shuffled, {
      opacity: 1,
      duration: 0.25,
      ease: "power2.out",
      stagger: {
        each: 0.06,
        from: "random",
      },
      onComplete: () => {
        // After all images are in, zoom the canvas in slightly
        gsap.to(wrapper, {
          scale: 1,
          duration: 1.8,
          ease: "expo.inOut",
          onComplete: () => {
            initDraggable()
            zoomRef.current = 2
            setZoomLevel(2)
          },
        })
      },
    })
  }, [initDraggable])

  useEffect(() => {
    if (!active) return
    const wrapper = wrapperRef.current
    const collection = collectionRef.current
    if (!wrapper || !collection) return

    xSet.current = gsap.quickSetter(collection, "x", "px") as (v: number) => void
    ySet.current = gsap.quickSetter(collection, "y", "px") as (v: number) => void

    // Center the canvas initially
    const centerX = Math.max(0, (wrapper.offsetWidth - collection.scrollWidth) / 2)
    const centerY = 60
    positionRef.current = { x: centerX, y: centerY }
    targetRef.current = { x: centerX, y: centerY }
    gsap.set(collection, { x: centerX, y: centerY })

    wrapper.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      wrapper.removeEventListener("wheel", onWheel)
      draggableRef.current.forEach((d) => d.kill())
      cancelAnimationFrame(rafRef.current)
    }
  }, [active, onWheel])

  return { wrapperRef, collectionRef, zoomLevel, zoomIn, zoomOut, runEntrance }
}
