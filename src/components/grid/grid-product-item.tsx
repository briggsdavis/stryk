import { useRef } from "react"
import type { Product } from "../../lib/types"
import { HoverLabel } from "../ui/hover-label"

interface GridProductItemProps {
  product: Product
  onClick: (product: Product, el: HTMLElement) => void
  itemRef?: (el: HTMLElement | null) => void
}

const DRAG_THRESHOLD = 6

export function GridProductItem({ product, onClick, itemRef }: GridProductItemProps) {
  const cardRef = useRef<HTMLButtonElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  // Pointer-drag to scroll the image track; native scroll-snap settles it.
  const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0, moved: 0 })

  const images = product.images && product.images.length > 0 ? product.images : [product.image]

  const focus = () => {
    if (cardRef.current) onClick(product, cardRef.current)
  }

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
      cardRef.current?.setPointerCapture(e.pointerId)
      track.scrollLeft = d.scrollLeft - dx
    }
  }
  const onPointerUp = () => {
    dragRef.current.active = false
  }
  // Swallow the focus click when the gesture was a drag.
  const onClickCapture = (e: React.MouseEvent) => {
    if (dragRef.current.moved > DRAG_THRESHOLD) {
      e.stopPropagation()
      e.preventDefault()
    }
  }

  return (
    <div className="grid-reveal group flex flex-col">
      <button
        type="button"
        ref={(el) => {
          cardRef.current = el
          itemRef?.(el)
        }}
        className="grid-card"
        data-product-id={product.id}
        aria-label={`${product.name} — view`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
        onClick={focus}
      >
        {/* Draggable image track */}
        <div ref={trackRef} className="grid-card-track">
          {images.map((src, i) => (
            <div key={i} className="grid-card-slide">
              <img src={src} alt={`${product.name} ${i + 1}`} draggable={false} />
            </div>
          ))}
        </div>

        {/* Hover overlays */}
        <span className="group/explore absolute top-3 right-3 flex translate-y-1 items-center gap-2 rounded-lg bg-dark px-4 py-2.5 text-sm font-medium text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <HoverLabel>explore</HoverLabel>
          <span className="transition-transform duration-300 group-hover/explore:translate-x-1">
            →
          </span>
        </span>

        {images.length > 1 && (
          <span className="absolute right-3 bottom-3 flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-dark/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span aria-hidden="true">↔</span> Drag for more
          </span>
        )}
      </button>

      {/* Caption row */}
      <div className="mt-3 flex items-baseline justify-between">
        <p className="text-base text-dark">{product.name}</p>
        <p className="text-base text-dark/70">${product.price}</p>
      </div>
    </div>
  )
}
