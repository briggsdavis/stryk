import { useCallback, useEffect, useRef, useState } from "react"
import { Draggable, gsap } from "../lib/gsap"
import type { ZoomLevel } from "../lib/types"

// Each level keeps scale × factor ≈ 1 so the scaled wrapper still fills the
// viewport while exposing `factor`× more of the canvas. Level 0 is a deep
// zoom-out for browsing large collections (~2.5× more reach than level 1).
const ZOOM_CONFIGS: Record<ZoomLevel, { scale: number; wFactor: number; hFactor: number }> = {
  2: { scale: 1.0, wFactor: 1, hFactor: 1 },
  1: { scale: 0.6, wFactor: 1.67, hFactor: 1.67 },
  0: { scale: 0.24, wFactor: 4.17, hFactor: 4.17 },
}

export function useXpCanvas(active: boolean) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const collectionRef = useRef<HTMLDivElement>(null)
  const draggableRef = useRef<Draggable[]>([])
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(2)
  const zoomRef = useRef<ZoomLevel>(2)
  const [entranceComplete, setEntranceComplete] = useState(false)

  // smooth pan via lerp
  const positionRef = useRef({ x: 0, y: 0 })
  const targetRef = useRef({ x: 0, y: 0 })
  const rafRef = useRef<number>(0)
  const xSet = useRef<((v: number) => void) | null>(null)
  const ySet = useRef<((v: number) => void) | null>(null)

  // Pan bounds for a given wrapper/content size. `lockCenter` is used at the
  // deepest zoom-out: there the wrapper layout is far larger than the artwork, so
  // instead of the standard edge bounds we pin each axis to its centred position
  // — keeping the cluster centred in the void rather than shoved to a corner.
  const boundsFor = (ww: number, wh: number, cw: number, ch: number, lockCenter: boolean) => {
    const axis = (wd: number, cd: number): [number, number] => {
      if (lockCenter && cd < wd) {
        const c = (wd - cd) / 2
        return [c, c]
      }
      return [Math.min(0, wd - cd - 80), 80]
    }
    const [minX, maxX] = axis(ww, cw)
    const [minY, maxY] = axis(wh, ch)
    return { minX, maxX, minY, maxY }
  }

  const getBounds = useCallback(() => {
    const wrapper = wrapperRef.current
    const collection = collectionRef.current
    if (!wrapper || !collection) return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
    return boundsFor(
      wrapper.offsetWidth,
      wrapper.offsetHeight,
      collection.scrollWidth,
      collection.scrollHeight,
      zoomRef.current === 0,
    )
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
      const next = clamp(targetRef.current.x - e.deltaX * 0.7, targetRef.current.y - e.deltaY * 0.7)
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
    (level: ZoomLevel, prevLevel: ZoomLevel) => {
      const wrapper = wrapperRef.current
      const collection = collectionRef.current
      if (!wrapper || !collection) return
      const cfg = ZOOM_CONFIGS[level]
      const prevCfg = ZOOM_CONFIGS[prevLevel]

      // Shift the collection so the canvas point at viewport center stays centered.
      // Derivation: the canvas center point in wrapper-local coords is
      //   P = wFactor * vw/2 - collection.x
      // For P to stay at viewport center after zoom, new collection.x must be:
      //   new_x = old_x + (newWFactor - oldWFactor) * vw/2
      const vw = window.innerWidth
      const vh = window.innerHeight
      const newXraw = positionRef.current.x + ((cfg.wFactor - prevCfg.wFactor) * vw) / 2
      const newYraw = positionRef.current.y + ((cfg.hFactor - prevCfg.hFactor) * vh) / 2

      // Clamp to the new level's bounds, computed against the *target* wrapper
      // size (it hasn't resized yet). At the deepest level this recentres the
      // cluster instead of leaving it pushed to one side.
      const tb = boundsFor(
        cfg.wFactor * vw,
        cfg.hFactor * vh,
        collection.scrollWidth,
        collection.scrollHeight,
        level === 0,
      )
      const newX = Math.max(tb.minX, Math.min(tb.maxX, newXraw))
      const newY = Math.max(tb.minY, Math.min(tb.maxY, newYraw))

      positionRef.current = { x: newX, y: newY }
      targetRef.current = { x: newX, y: newY }

      gsap.to(collection, { x: newX, y: newY, duration: 1.5, ease: "expo.inOut" })
      gsap.to(wrapper, {
        scale: cfg.scale,
        width: `${cfg.wFactor * 100}vw`,
        height: `${cfg.hFactor * 100}vh`,
        left: `${(1 - cfg.wFactor) * 50}vw`,
        top: `${(1 - cfg.hFactor) * 50}vh`,
        duration: 1.5,
        ease: "expo.inOut",
        onComplete: initDraggable,
      })
    },
    [initDraggable],
  )

  // Snap the collection to the centred position for the new cluster and reset to
  // the base zoom level. This is intentionally instant: the caller pairs it with
  // a Flip tween that glides the pieces from their old on-screen positions to
  // these new ones, so the centring is absorbed into a single smooth motion
  // rather than a separate camera pan.
  const recenter = useCallback(() => {
    const wrapper = wrapperRef.current
    const collection = collectionRef.current
    if (!wrapper || !collection) return

    if (zoomRef.current !== 2) {
      const cfg = ZOOM_CONFIGS[2]
      gsap.set(wrapper, {
        scale: cfg.scale,
        width: `${cfg.wFactor * 100}vw`,
        height: `${cfg.hFactor * 100}vh`,
        left: 0,
        top: 0,
      })
      zoomRef.current = 2
      setZoomLevel(2)
    }

    // Measure against the base viewport size: at rest the wrapper is 100vw×100vh.
    const centerX = (window.innerWidth - collection.scrollWidth) / 2
    const centerY = (window.innerHeight - collection.scrollHeight) / 2
    positionRef.current = { x: centerX, y: centerY }
    targetRef.current = { x: centerX, y: centerY }
    cancelAnimationFrame(rafRef.current)
    gsap.killTweensOf(collection)
    gsap.set(collection, { x: centerX, y: centerY })
    initDraggable()
  }, [initDraggable])

  const zoomIn = useCallback(() => {
    if (zoomRef.current >= 2) return
    const prev = zoomRef.current as ZoomLevel
    const next = (prev + 1) as ZoomLevel
    zoomRef.current = next
    setZoomLevel(next)
    applyZoom(next, prev)
  }, [applyZoom])

  const zoomOut = useCallback(() => {
    if (zoomRef.current <= 0) return
    const prev = zoomRef.current as ZoomLevel
    const next = (prev - 1) as ZoomLevel
    zoomRef.current = next
    setZoomLevel(next)
    applyZoom(next, prev)
  }, [applyZoom])

  const runEntrance = useCallback(() => {
    const wrapper = wrapperRef.current
    const collection = collectionRef.current
    if (!wrapper || !collection) return

    const items = collection.querySelectorAll<HTMLElement>(".xp-item")

    // Allow items at the edges to be visible during the zoomed-out entrance -
    // the wrapper's layout box is 100vw×100vh so overflow:hidden would clip them.
    gsap.set(wrapper, { scale: 0.85, transformOrigin: "center center", overflow: "visible" })

    const shuffled = [...items].sort(() => Math.random() - 0.5)

    gsap.set(shuffled, { scale: 0.65, filter: "blur(14px)" })
    gsap.to(shuffled, {
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      duration: 0.45,
      ease: "back.out(1.2)",
      stagger: { each: 0.03, from: "random" },
      onComplete: () => {
        gsap.to(wrapper, {
          scale: 1,
          duration: 1.6,
          ease: "expo.inOut",
          onComplete: () => {
            gsap.set(wrapper, { overflow: "hidden" })
            initDraggable()
            zoomRef.current = 2
            setZoomLevel(2)
            setEntranceComplete(true)
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

    // Center the canvas so the middle of the collection is at the viewport center
    const centerX = (wrapper.offsetWidth - collection.scrollWidth) / 2
    const centerY = (wrapper.offsetHeight - collection.scrollHeight) / 2
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

  return {
    wrapperRef,
    collectionRef,
    zoomLevel,
    zoomIn,
    zoomOut,
    runEntrance,
    entranceComplete,
    recenter,
  }
}
