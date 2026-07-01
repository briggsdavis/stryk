import type { CSSProperties } from "react"
import type { Product } from "../../lib/types"

export const CANVAS_ITEM_WIDTH = 18

interface XpProductItemProps {
  product: Product
  onClick: (product: Product, el: HTMLElement) => void
  itemRef?: (el: HTMLElement | null) => void
  style?: CSSProperties
}

export function XpProductItem({ product, onClick, itemRef, style }: XpProductItemProps) {
  return (
    <button
      type="button"
      className="xp-item"
      style={{
        width: `${CANVAS_ITEM_WIDTH}vw`,
        flexShrink: 0,
        overflow: "hidden",
        position: "relative",
        padding: 0,
        border: "none",
        background: "#f0ede6",
        appearance: "none",
        ...style,
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
