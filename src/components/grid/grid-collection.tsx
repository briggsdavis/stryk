import React, { useEffect, useMemo, useRef } from "react"
import { Footer } from "../../components/ui/footer"
import { useLenis } from "../../hooks/use-lenis"
import type { ActiveFilters, FilterGroup, FilterKey } from "../../lib/filters"
import { productMatches } from "../../lib/filters"
import { gsap, ScrollTrigger } from "../../lib/gsap"
import type { Product } from "../../lib/types"
import { EmptyFilterState } from "../ui/empty-filter-state"
import { FilterPills } from "../ui/filter-pills"
import { GridProductItem } from "./grid-product-item"

interface GridCollectionProps {
  products: Product[]
  filters: ActiveFilters
  filterGroups: FilterGroup[]
  onToggleFilter: (key: FilterKey, value: string) => void
  onClearFilters: () => void
  onItemClick: (product: Product, el: HTMLElement) => void
  onContact: () => void
  itemRefs: React.MutableRefObject<Map<string, HTMLElement>>
  visible: boolean
  scrollerRef: React.RefObject<HTMLDivElement | null>
}

export function GridCollection({
  products,
  filters,
  filterGroups,
  onToggleFilter,
  onClearFilters,
  onItemClick,
  onContact,
  itemRefs,
  visible,
  scrollerRef,
}: GridCollectionProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useLenis(visible, scrollerRef as React.RefObject<HTMLElement | null>)

  const filtered = useMemo(
    () => products.filter((p) => productMatches(p, filters)),
    [products, filters],
  )

  useEffect(() => {
    if (!visible || !containerRef.current || !scrollerRef.current) return

    const scroller = scrollerRef.current
    const items = containerRef.current.querySelectorAll<HTMLElement>(".grid-reveal")
    gsap.set(items, { scale: 0.92, opacity: 0 })

    ScrollTrigger.batch(items, {
      scroller,
      start: "top 92%",
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
    ScrollTrigger.refresh()

    return () => ScrollTrigger.getAll().forEach((t) => t.kill())
  }, [visible, filtered, scrollerRef])

  if (!visible) return null

  return (
    <div ref={containerRef} className="min-h-screen px-6 pt-36 pb-28 md:px-10 md:pt-40">
      <header className="mb-12 md:mb-16">
        <h1 className="text-128 max-w-[15ch] text-dark">Matchbox art from around the world</h1>
        <p className="mt-8 max-w-md text-sm leading-relaxed text-dark/60">
          Vintage matchboxes and matchbooks sourced from Japan, Kenya, France, Germany, Italy, and
          across the US — each one a miniature masterpiece of graphic design.
        </p>
        {/* Filter — inline at the top of the grid */}
        <div className="mt-9 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-medium tracking-widest text-dark/40 uppercase">
            Filter
          </span>
          <FilterPills
            groups={filterGroups}
            active={filters}
            onToggleOption={onToggleFilter}
            onClear={onClearFilters}
            popoverSide="bottom"
          />
        </div>
      </header>

      {filtered.length === 0 ? (
        <EmptyFilterState onContact={onContact} className="py-20 md:py-28" />
      ) : (
        <div className="grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
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
      )}
      <Footer />
    </div>
  )
}
