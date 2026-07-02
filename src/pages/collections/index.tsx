import { ArrowRight } from "@phosphor-icons/react"
import { useQuery } from "convex/react"
import { useEffect, useRef } from "react"
import { api } from "../../../convex/_generated/api"
import { Footer } from "../../components/ui/footer"
import { Navbar } from "../../components/ui/navbar"
import { useLenis } from "../../hooks/use-lenis"
import { gsap, ScrollTrigger } from "../../lib/gsap"
import { useTransitionNavigate } from "../../lib/transition"

const EMPTY_PREVIEW_SLOTS = [
  "empty-preview-1",
  "empty-preview-2",
  "empty-preview-3",
  "empty-preview-4",
]

const DRAG_THRESHOLD = 6
const PREVIEW_PAGE_SIZE = 4

type PreviewProduct = { _id: string; title: string; image: string }

// Chunk a collection's preview products into pages of four so each page renders
// as one 2x2 collage inside the horizontal drag track.
function chunkPreview(products: PreviewProduct[]) {
  const pages: PreviewProduct[][] = []
  for (let i = 0; i < products.length; i += PREVIEW_PAGE_SIZE) {
    pages.push(products.slice(i, i + PREVIEW_PAGE_SIZE))
  }
  return pages.length > 0 ? pages : [[]]
}

// A single collection card. The 2x2 preview is a horizontal snap track: drag or
// swipe left/right to page through more of the collection's pieces. A drag is
// swallowed so it never triggers the card's navigation click.
function CollectionCard({
  name,
  tagline,
  products,
  onOpen,
}: {
  name: string
  tagline: string
  products: PreviewProduct[]
  onOpen: () => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0, moved: 0 })
  const pages = chunkPreview(products)
  const hasMore = pages.length > 1

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
      track.setPointerCapture(e.pointerId)
      track.scrollLeft = d.scrollLeft - dx
    }
  }
  const onPointerUp = () => {
    dragRef.current.active = false
  }
  // Swallow the navigation click when the gesture was actually a drag.
  const onTrackClickCapture = (e: React.MouseEvent) => {
    if (dragRef.current.moved > DRAG_THRESHOLD) {
      e.stopPropagation()
      e.preventDefault()
    }
  }

  return (
    <button
      data-collection-card
      type="button"
      onClick={onOpen}
      aria-label={`View the ${name} collection`}
      className="group block text-left"
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-48 leading-none font-medium text-dark">{name}</h2>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-dark/55 transition-colors group-hover:text-dark">
          view
          <ArrowRight
            aria-hidden="true"
            size={15}
            weight="regular"
            className="transition-transform duration-300 group-hover:translate-x-1"
          />
        </span>
      </div>

      {/* Draggable preview track - each page is a 2x2 collage of the collection. */}
      <div className="relative aspect-square w-full overflow-hidden">
        <div
          ref={trackRef}
          className="collection-preview-track absolute inset-0 flex"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClickCapture={onTrackClickCapture}
        >
          {pages.map((page, pi) => (
            <div
              key={pi}
              className="collection-preview-page grid aspect-square w-full shrink-0 grid-cols-2 grid-rows-2 gap-1"
            >
              {page.map((product) => (
                <div
                  key={product._id}
                  className="relative min-h-0 min-w-0 overflow-hidden bg-dark/5"
                >
                  <img
                    src={product.image}
                    alt={product.title}
                    loading="lazy"
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
              {EMPTY_PREVIEW_SLOTS.slice(page.length).map((slot) => (
                <div key={slot} className="min-h-0 min-w-0 bg-dark/5" aria-hidden="true" />
              ))}
            </div>
          ))}
        </div>

        {hasMore && (
          <span className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-canvas/85 px-2.5 py-1 text-[11px] font-medium tracking-wide text-dark/60 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
            <span aria-hidden="true">↔</span> Drag for more
          </span>
        )}
      </div>

      <p className="mt-2 max-w-md text-sm text-dark/55">{tagline}</p>
    </button>
  )
}

export function CollectionsPage() {
  useLenis()
  const transitionNavigate = useTransitionNavigate()
  const gridRef = useRef<HTMLDivElement>(null)
  const collectionsResult = useQuery(api.catalog.listCollectionsWithProductPreviews, {
    paginationOpts: { numItems: 250, cursor: null },
    productLimit: 12,
  })
  const collections =
    collectionsResult?.page.map(({ collection, products }) => ({
      slug: collection.shopifyHandle,
      name: collection.title,
      tagline: collection.tagline ?? collection.description ?? "",
      products,
    })) ?? []

  // Each card blurs + rises into view as it scrolls in.
  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>("[data-collection-card]")
      cards.forEach((card) => {
        gsap.set(card, { opacity: 0, y: 40, filter: "blur(10px)" })
        ScrollTrigger.create({
          trigger: card,
          start: "top 88%",
          once: true,
          onEnter: () =>
            gsap.to(card, {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              duration: 0.9,
              ease: "power3.out",
            }),
        })
      })
    }, grid)
    return () => ctx.revert()
  }, [collections.length])

  return (
    <div className="bg-canvas text-dark">
      <Navbar />

      {/* ── Intro ── */}
      <section className="px-6 pt-28 pb-10 md:px-10 md:pt-32">
        <p className="mb-4 text-xs font-medium tracking-widest text-dark/40 uppercase">Browse</p>
        <h1 className="text-128 leading-none font-medium">Collections</h1>
        <p className="mt-6 max-w-xl text-lg text-dark/60">
          Explore the matchbox archives collection by collection and find the pieces that speak to
          you.
        </p>
      </section>

      {/* ── Collection cards — even two-column grid ── */}
      <section
        ref={gridRef}
        className="grid grid-cols-1 gap-x-10 gap-y-14 px-6 pb-28 md:grid-cols-2 md:px-10"
      >
        {collections.map((c) => (
          <CollectionCard
            key={c.slug}
            name={c.name}
            tagline={c.tagline}
            products={c.products}
            onOpen={() => transitionNavigate(`/collection/${c.slug}`)}
          />
        ))}
      </section>

      <Footer />
    </div>
  )
}
