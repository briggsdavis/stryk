import { useRef } from "react"
import { useImageTrack } from "../../hooks/use-image-track"
import type { Product } from "../../lib/types"

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface CollectionProductCardProps {
  product: Product
  // Opens the product into the focus panel, morphing from the in-view image.
  onOpen: (product: Product, img: HTMLImageElement) => void
  itemRef?: (img: HTMLImageElement | null) => void
}

// A collection product tile that lets you swipe/drag between the product's images
// (mobile + desktop) and taps through to the focus morph - mirroring the grid card.
export function CollectionProductCard({ product, onOpen, itemRef }: CollectionProductCardProps) {
  const cardRef = useRef<HTMLButtonElement>(null)
  const { trackRef, handlers, wasDragged, currentImage } = useImageTrack(cardRef)

  const images = product.images && product.images.length > 0 ? product.images : [product.image]

  const open = () => {
    const img = currentImage()
    if (img) onOpen(product, img)
  }

  const onClickCapture = (e: React.MouseEvent) => {
    // A drag shouldn't also trigger the open morph.
    if (wasDragged()) {
      e.stopPropagation()
      e.preventDefault()
    }
  }

  return (
    <div className="flex flex-col">
      <button
        ref={cardRef}
        type="button"
        {...handlers}
        onClickCapture={onClickCapture}
        onClick={open}
        aria-label={`Open ${product.name}`}
        className="group relative aspect-square w-full overflow-hidden rounded-xl border border-dark/15 transition-colors hover:border-dark/30"
        style={{ touchAction: "pan-y" }}
      >
        {/* Draggable image track */}
        <div ref={trackRef} className="grid-card-track">
          {images.map((src, i) => (
            <div key={i} className="grid-card-slide">
              <img
                ref={i === 0 ? itemRef : undefined}
                src={src}
                alt={`${product.name} ${i + 1}`}
                draggable={false}
                className="max-h-full max-w-full object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.19)]"
              />
            </div>
          ))}
        </div>

        <span className="absolute top-3 right-3 text-dark/40 transition-all duration-300 group-hover:scale-110 group-hover:text-dark">
          <ExpandIcon />
        </span>

        {images.length > 1 && (
          <span className="absolute right-3 bottom-3 flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-dark/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span aria-hidden="true">↔</span> Drag
          </span>
        )}
      </button>
      <p className="mt-3 text-sm text-dark/70">{product.name}</p>
    </div>
  )
}
