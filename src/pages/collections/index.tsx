import { clsx } from "clsx"
import { useEffect, useRef } from "react"
import { Footer } from "../../components/ui/footer"
import { Navbar } from "../../components/ui/navbar"
import { useLenis } from "../../hooks/use-lenis"
import { listCollections } from "../../lib/demo-data"
import { gsap, ScrollTrigger } from "../../lib/gsap"
import { useTransitionNavigate } from "../../lib/transition"

const COLLECTIONS = listCollections()

export function CollectionsPage() {
  useLenis()
  const transitionNavigate = useTransitionNavigate()
  const gridRef = useRef<HTMLDivElement>(null)

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
  }, [])

  return (
    <div className="bg-canvas text-dark">
      <Navbar />

      {/* ── Intro ── */}
      <section className="px-6 pt-28 pb-10 md:px-10 md:pt-32">
        <p className="mb-4 text-xs font-medium tracking-widest text-dark/40 uppercase">Browse</p>
        <h1 className="text-128 leading-none font-medium">Collections</h1>
        <p className="mt-6 max-w-xl text-lg text-dark/60">
          Ten cities, each with a graphic language all its own. Explore the matchbox archives city
          by city and find the pieces that speak to you.
        </p>
      </section>

      {/* ── Collection cards — two columns, gently staggered ── */}
      <section
        ref={gridRef}
        className="grid grid-cols-1 gap-x-10 gap-y-14 px-6 pb-28 md:grid-cols-2 md:px-10"
      >
        {COLLECTIONS.map((c, i) => (
          <button
            key={c.slug}
            data-collection-card
            type="button"
            onClick={() => transitionNavigate(`/collection/${c.slug}`)}
            aria-label={`View the ${c.name} collection`}
            className={clsx("group block text-left", i % 2 === 1 && "md:mt-24")}
          >
            <div className="relative aspect-square w-full overflow-hidden">
              <img
                src={c.image}
                alt={c.name}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
              />
            </div>
            <div className="mt-5 flex items-end justify-between gap-4">
              <h2 className="text-48 leading-none font-medium text-dark">{c.name}</h2>
              <span className="mb-1 inline-flex items-center gap-1.5 text-sm font-medium text-dark/55 transition-colors group-hover:text-dark">
                view
                <span className="transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </span>
            </div>
            <p className="mt-2 max-w-md text-sm text-dark/55">{c.tagline}</p>
          </button>
        ))}
      </section>

      <Footer />
    </div>
  )
}
