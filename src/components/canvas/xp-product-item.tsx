import type { Product } from "../../lib/types"

// Varied widths only - each image's natural aspect ratio decides its height,
// so thumbnails are shown uncropped at their true proportions.
const WIDTH_VARIANTS = [
  "18vw",
  "14vw",
  "22vw",
  "12vw",
  "16vw",
  "20vw",
  "24vw",
  "13vw",
  "19vw",
  "22vw",
  "15vw",
  "17vw",
]

interface XpProductItemProps {
  product: Product
  index: number
  onClick: (product: Product, el: HTMLElement) => void
  itemRef?: (el: HTMLElement | null) => void
}

export function XpProductItem({ product, index, onClick, itemRef }: XpProductItemProps) {
  const width = WIDTH_VARIANTS[index % WIDTH_VARIANTS.length]

  return (
    <button
      type="button"
      className="xp-item"
      style={{
        width,
        flexShrink: 0,
        overflow: "hidden",
        position: "relative",
        padding: 0,
        border: "none",
        background: "none",
        appearance: "none",
      }}
      data-cursor={product.name}
      data-product-id={product.id}
      data-flip-id={product.id}
      ref={itemRef}
      onClick={(e) => onClick(product, e.currentTarget)}
    >
      <img
        src={product.image}
        alt={product.name}
        draggable={false}
        className="pointer-events-none h-full w-full object-cover"
      />
    </button>
  )
}
