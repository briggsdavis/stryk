import { useQuery } from "convex/react"
import { useEffect, useRef } from "react"
import { Link } from "react-router"
import { api } from "../../../convex/_generated/api"
import { Footer } from "../../components/ui/footer"
import { Navbar } from "../../components/ui/navbar"
import { useLenis } from "../../hooks/use-lenis"
import { gsap, ScrollTrigger } from "../../lib/gsap"
import { useTransitionNavigate } from "../../lib/transition"

type PreviewProduct = { _id: string; title: string; image: string }

function CollectionCard({
  name,
  products,
  to,
  onOpen,
}: {
  name: string
  products: PreviewProduct[]
  to: string
  onOpen: () => void
}) {
  const preview = products[0]

  return (
    <Link
      data-collection-card
      to={to}
      onClick={(event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.altKey ||
          event.ctrlKey ||
          event.shiftKey
        ) {
          return
        }
        event.preventDefault()
        onOpen()
      }}
      aria-label={`View the ${name} collection`}
      className="group block w-full text-left"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-dark/5">
        {preview && (
          <img
            src={preview.image}
            alt={preview.title}
            loading="lazy"
            draggable={false}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        )}
        <div
          className="collection-card-shade pointer-events-none absolute inset-x-0 bottom-0"
          aria-hidden="true"
        />
        <h2 className="pointer-events-none absolute inset-x-0 bottom-0 px-5 pb-5 text-center text-3xl leading-tight font-medium text-white md:text-5xl">
          {name}
        </h2>
      </div>
    </Link>
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
            products={c.products}
            to={`/collection/${c.slug}`}
            onOpen={() => transitionNavigate(`/collection/${c.slug}`)}
          />
        ))}
      </section>

      <Footer />
    </div>
  )
}
