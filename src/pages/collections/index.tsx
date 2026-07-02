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

export function CollectionsPage() {
  useLenis()
  const transitionNavigate = useTransitionNavigate()
  const gridRef = useRef<HTMLDivElement>(null)
  const collectionsResult = useQuery(api.catalog.listCollectionsWithProductPreviews, {
    paginationOpts: { numItems: 250, cursor: null },
    productLimit: 4,
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
          <button
            key={c.slug}
            data-collection-card
            type="button"
            onClick={() => transitionNavigate(`/collection/${c.slug}`)}
            aria-label={`View the ${c.name} collection`}
            className="group block text-left"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-48 leading-none font-medium text-dark">{c.name}</h2>
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
            <div className="grid aspect-square w-full grid-cols-2 grid-rows-2 gap-1 overflow-hidden">
              {c.products.map((product) => (
                <div
                  key={product._id}
                  className="relative min-h-0 min-w-0 overflow-hidden bg-dark/5"
                >
                  <img
                    src={product.image}
                    alt={product.title}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
              {EMPTY_PREVIEW_SLOTS.slice(c.products.length).map((slot) => (
                <div key={slot} className="min-h-0 min-w-0 bg-dark/5" aria-hidden="true" />
              ))}
            </div>
            <p className="mt-2 max-w-md text-sm text-dark/55">{c.tagline}</p>
          </button>
        ))}
      </section>

      <Footer />
    </div>
  )
}
