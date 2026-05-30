import type { Product } from "../../lib/types"

interface GridProductItemProps {
  product: Product
  onClick: (product: Product, el: HTMLElement) => void
  itemRef?: (el: HTMLButtonElement | null) => void
}

export function GridProductItem({ product, onClick, itemRef }: GridProductItemProps) {
  return (
    <button
      type="button"
      className="grid-item group block w-full appearance-none p-0 text-left"
      data-product-id={product.id}
      ref={itemRef}
      onClick={(e) => onClick(product, e.currentTarget)}
    >
      <img src={product.image} alt={product.name} />
      <div className="absolute inset-x-3 bottom-3 flex translate-y-2 items-center justify-between rounded-lg border border-dark/10 bg-canvas/90 px-3 py-2 opacity-0 backdrop-blur-sm transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
        <p className="text-[11px] font-medium tracking-widest text-dark uppercase">
          {product.name}
        </p>
        <p className="text-[11px] text-dark/50">${product.price}</p>
      </div>
    </button>
  )
}
