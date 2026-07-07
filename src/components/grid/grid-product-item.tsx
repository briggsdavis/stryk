import { useRef } from "react"
import { useImageTrack } from "../../hooks/use-image-track"
import type { Product } from "../../lib/types"
import { HoverLabel } from "../ui/hover-label"

interface GridProductItemProps {
  product: Product
  onClick: (product: Product, el: HTMLElement) => void
  itemRef?: (el: HTMLElement | null) => void
}

export function GridProductItem({ product, onClick, itemRef }: GridProductItemProps) {
  const cardRef = useRef<HTMLButtonElement>(null)
  const { trackRef, handlers, wasDragged, currentImage } = useImageTrack(cardRef)

  const images = product.images && product.images.length > 0 ? product.images : [product.image]

  // Morph only the image that's currently in view, not the whole card frame.
  const focus = () => {
    const target = currentImage() ?? cardRef.current
    if (target) onClick(product, target)
  }

  // Swallow the focus click when the gesture was a drag.
  const onClickCapture = (e: React.MouseEvent) => {
    if (wasDragged()) {
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
        data-cursor-label={product.name}
        aria-label={`${product.name} - view`}
        {...handlers}
        onClickCapture={onClickCapture}
        onClick={focus}
      >
        {/* Draggable image track */}
        <div ref={trackRef} className="grid-card-track">
          {images.map((src, i) => (
            <div key={i} className="grid-card-slide">
              {/* object-contain inline so the image keeps its aspect once it is
                  lifted out of the card into the focus slot during the morph. */}
              <img
                src={src}
                alt={`${product.name} ${i + 1}`}
                draggable={false}
                className="max-h-full max-w-full object-contain"
              />
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
