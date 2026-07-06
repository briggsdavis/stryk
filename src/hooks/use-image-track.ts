import { useRef } from "react"

const DRAG_THRESHOLD = 6

// Pointer-drag to scroll a horizontal image track; native scroll-snap settles it.
// Works for mouse and touch alike - the track carries `touch-action: pan-y`, so a
// horizontal finger drag is handed to JS while vertical page scroll stays native.
// Shared by the grid cards and the collection product cards so both swipe between
// a product's images identically.
export function useImageTrack(captureRef: React.RefObject<HTMLElement | null>) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0, moved: 0 })

  const onPointerDown = (e: React.PointerEvent) => {
    const track = trackRef.current
    if (!track) return
    dragRef.current = { active: true, startX: e.clientX, scrollLeft: track.scrollLeft, moved: 0 }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const track = trackRef.current
    const d = dragRef.current
    if (!track || !d.active) return
    const dx = e.clientX - d.startX
    d.moved = Math.max(d.moved, Math.abs(dx))
    if (d.moved > DRAG_THRESHOLD) {
      captureRef.current?.setPointerCapture(e.pointerId)
      track.scrollLeft = d.scrollLeft - dx
    }
  }

  const onPointerUp = () => {
    dragRef.current.active = false
  }

  // True while the last gesture crossed the drag threshold - callers use it to
  // swallow the tap/click that would otherwise fire on release.
  const wasDragged = () => dragRef.current.moved > DRAG_THRESHOLD

  // The <img> in whichever slide is currently snapped into view.
  const currentImage = (): HTMLImageElement | null => {
    const track = trackRef.current
    if (!track) return null
    const idx = Math.min(
      Math.max(Math.round(track.scrollLeft / (track.clientWidth || 1)), 0),
      track.children.length - 1,
    )
    const slide = track.children[idx] as HTMLElement | undefined
    return (slide?.querySelector("img") as HTMLImageElement | null) ?? null
  }

  const handlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  }

  return { trackRef, handlers, wasDragged, currentImage }
}
