import React, { useEffect, useRef } from "react"
import { Footer } from "../../components/ui/footer"
import { useLenis } from "../../hooks/use-lenis"
import { gsap, ScrollTrigger } from "../../lib/gsap"
import type { Product } from "../../lib/types"
import { GridProductItem } from "./grid-product-item"

interface GridCollectionProps {
  products: Product[]
  onItemClick: (product: Product, el: HTMLElement) => void
  itemRefs: React.MutableRefObject<Map<string, HTMLElement>>
  visible: boolean
  scrollerRef: React.RefObject<HTMLDivElement | null>
}

export function GridCollection({
  products,
  onItemClick,
  itemRefs,
  visible,
  scrollerRef,
}: GridCollectionProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useLenis(visible, scrollerRef as React.RefObject<HTMLElement | null>)

  useEffect(() => {
    if (!visible || !containerRef.current || !scrollerRef.current) return

    const scroller = scrollerRef.current
    const items = containerRef.current.querySelectorAll<HTMLElement>(".grid-item")
    gsap.set(items, { scale: 0.9, opacity: 0 })

    ScrollTrigger.batch(items, {
      scroller,
      start: "top 90%",
      onEnter: (els) => {
        gsap.to(els, {
          scale: 1,
          opacity: 1,
          duration: 0.6,
          ease: "back.out(1.2)",
          stagger: 0.06,
        })
      },
    })

    return () => ScrollTrigger.getAll().forEach((t) => t.kill())
  }, [visible, products, scrollerRef])

  if (!visible) return null

  return (
    <div ref={containerRef} className="min-h-screen px-6 pt-36 pb-28 md:px-10 md:pt-40">
      <header className="mb-16 md:mb-24">
        <h1 className="text-128 max-w-[15ch] text-dark">Matchbox art from around the world</h1>
        <p className="mt-8 max-w-md text-sm leading-relaxed text-dark/60">
          Vintage matchboxes and matchbooks sourced from Japan, Kenya, France, Germany, Italy, and
          across the US — each one a miniature masterpiece of graphic design.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <GridProductItem
            key={product.id}
            product={product}
            onClick={onItemClick}
            itemRef={(el) => {
              if (el) itemRefs.current.set(product.id, el)
              else itemRefs.current.delete(product.id)
            }}
          />
        ))}
      </div>
      <Footer />
    </div>
  )
}
