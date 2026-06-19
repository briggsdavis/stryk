import { clsx } from "clsx"
import { useEffect, useRef, useState } from "react"
import { Accordion } from "../../components/ui/accordion"
import { Footer } from "../../components/ui/footer"
import { Navbar } from "../../components/ui/navbar"
import { useLenis } from "../../hooks/use-lenis"
import { useSplitReveal } from "../../hooks/use-scroll-reveal"
import { gsap, ScrollTrigger } from "../../lib/gsap"

// Square image that reveals with an upward wipe as it scrolls into view.
function RevealImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div className={clsx("reveal group relative overflow-hidden", className)}>
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
      />
      <div className="reveal-mask pointer-events-none absolute inset-0 bg-canvas" />
    </div>
  )
}

const SUSTAINABILITY_ITEMS = [
  {
    question: "Authentic sourcing",
    answer:
      "Every piece is sourced directly from estate sales, flea markets, and specialist dealers across Japan, Kenya, France, Germany, Italy, and the United States. We verify provenance before anything reaches our shelves.",
  },
  {
    question: "Historical accuracy",
    answer:
      "We research every label - dating it, identifying the brand, and tracing its regional context. What you receive comes with a record of its story, not just its image.",
  },
  {
    question: "Responsible preservation",
    answer:
      "Vintage paper is fragile. We archive originals in archival-grade sleeves and produce reprints only on acid-free stock, ensuring the work survives another hundred years.",
  },
  {
    question: "Sustainable packaging",
    answer:
      "All packaging is made from recycled or FSC-certified materials and is fully recyclable. We've eliminated all single-use plastics from our supply chain.",
  },
]

const VALUES = [
  {
    label: "Curation",
    body: "We don't list everything we find. Only pieces that stop us in our tracks make it to the store.",
    image: "https://images.unsplash.com/photo-1617784625140-515e220ba148?w=800&h=800&fit=crop&q=80",
  },
  {
    label: "Discovery",
    body: "Every matchbox is a portal - to a city, a decade, a brand that no longer exists. We live for that feeling.",
    image: "https://images.unsplash.com/photo-1594368247117-6012a8acda3e?w=800&h=800&fit=crop&q=80",
  },
  {
    label: "Craft",
    body: "The designers who made these labels had no digital tools, only instinct and a tight deadline. That tension shows in every line.",
    image: "https://images.unsplash.com/photo-1551807306-4bcd16b92a41?w=800&h=800&fit=crop&q=80",
  },
  {
    label: "Story",
    body: "No object without context. Every piece we sell comes with the history it earned.",
    image: "https://images.unsplash.com/photo-1619367302084-3d07eb49159f?w=800&h=800&fit=crop&q=80",
  },
]

const NUM_PANELS = 4

export function AboutPage() {
  useLenis()

  const horizontalRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const h1Ref = useRef<HTMLHeadingElement>(null)
  const [hoveredValue, setHoveredValue] = useState<string | null>(null)

  useSplitReveal(h1Ref)

  useEffect(() => {
    const horizontal = horizontalRef.current
    const track = trackRef.current
    if (!horizontal || !track) return

    const getTotal = () => (NUM_PANELS - 1) * window.innerWidth

    const ctx = gsap.context(() => {
      const horizontalTween = gsap.to(track, {
        x: () => -getTotal(),
        ease: "none",
        scrollTrigger: {
          trigger: horizontal,
          start: "top top",
          end: () => `+=${getTotal()}`,
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      })

      // Wipe-up reveal for each square image, driven by horizontal progress.
      const masks = gsap.utils.toArray<HTMLElement>(".reveal-mask")
      masks.forEach((mask) => {
        const wrap = mask.parentElement
        if (!wrap) return
        gsap.set(mask, { yPercent: 0 })
        ScrollTrigger.create({
          trigger: wrap,
          containerAnimation: horizontalTween,
          start: "left 80%",
          once: true,
          onEnter: () => gsap.to(mask, { yPercent: -100, duration: 1.1, ease: "power3.inOut" }),
        })
      })

      // Parallax drift on the Our Story image.
      const parImg = horizontal.querySelector<HTMLElement>(".parallax-img")
      if (parImg?.parentElement) {
        gsap.fromTo(
          parImg,
          { xPercent: -8 },
          {
            xPercent: 8,
            ease: "none",
            scrollTrigger: {
              trigger: parImg.parentElement,
              containerAnimation: horizontalTween,
              start: "left right",
              end: "right left",
              scrub: true,
            },
          },
        )
      }
    }, horizontal)

    return () => ctx.revert()
  }, [])

  return (
    <div className="bg-canvas text-dark">
      <Navbar />

      {/* ── Hero ── */}
      <section className="px-6 pt-28 pb-12 md:px-10 md:pt-32">
        <div className="group mb-8 overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1600&q=80"
            alt="Stryk studio"
            className="h-[38vh] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />
        </div>
        <p className="mb-4 text-xs font-medium tracking-widest text-dark/40 uppercase">
          About Stryk
        </p>
        <h1
          ref={h1Ref}
          className="text-128 max-w-4xl overflow-hidden pb-3 leading-none font-medium"
        >
          Vintage charm, modern walls
        </h1>
      </section>

      {/* ── Horizontal scroll ── */}
      <div ref={horizontalRef} className="h-screen overflow-hidden">
        <div ref={trackRef} className="flex h-full" style={{ width: `${NUM_PANELS * 100}vw` }}>
          {/* Panel 1 - Philosophy */}
          <div className="flex h-full w-screen flex-shrink-0 items-center gap-16 px-6 md:px-10">
            <div className="flex flex-1 flex-col justify-center">
              <p className="mb-8 text-xs font-medium tracking-widest text-dark/40 uppercase">
                Our Philosophy
              </p>
              <blockquote className="text-64 max-w-xl leading-tight font-light">
                The matchbox was the first mass-produced canvas. We're still finding the
                masterpieces.
              </blockquote>
              <p className="mt-10 max-w-sm text-sm leading-relaxed text-dark/55">
                Stryk sources matchboxes and matchbooks from flea markets, estate sales, and
                specialist dealers across four continents - and brings the best of them home as art.
              </p>
              <p className="mt-8 text-xs tracking-widest text-dark/25 uppercase">
                Est. 2021 - New York
              </p>
            </div>
            <div className="flex w-[34%] flex-col gap-4">
              <RevealImage
                src="https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=900&h=900&fit=crop&q=80"
                alt="Stryk ceramics"
                className="aspect-square w-full"
              />
              <RevealImage
                src="https://images.unsplash.com/photo-1597696929736-6d13bed8e6a8?w=900&h=900&fit=crop&q=80"
                alt="Stryk craft"
                className="aspect-square w-full"
              />
            </div>
          </div>

          {/* Panel 2 - Vision & Mission */}
          <div className="flex h-full w-screen flex-shrink-0 flex-col justify-center gap-6 px-6 md:px-10">
            <p className="text-xs font-medium tracking-widest text-dark/40 uppercase">
              What drives us
            </p>
            <div className="grid grid-cols-2 gap-16 border-t border-dark/10 pt-6">
              <div className="flex flex-col">
                <h3 className="mb-3 text-xs font-medium tracking-widest text-dark/40 uppercase">
                  Vision
                </h3>
                <p className="text-[1.2rem] leading-tight font-light">
                  Everyday objects, recognised as the art they always were.
                </p>
                <RevealImage
                  src="https://images.unsplash.com/photo-1610219171189-286769cc9b20?w=1000&h=1000&fit=crop&q=80"
                  alt="Stryk collection"
                  className="mt-5 aspect-square w-[60%] shrink-0"
                />
              </div>
              <div className="flex flex-col">
                <h3 className="mb-3 text-xs font-medium tracking-widest text-dark/40 uppercase">
                  Mission
                </h3>
                <p className="text-[1.2rem] leading-tight font-light">
                  To surface the world's forgotten matchbox art and give it a home.
                </p>
                <RevealImage
                  src="https://images.unsplash.com/photo-1626897885636-dd68020cc52a?w=1000&h=1000&fit=crop&q=80"
                  alt="Stryk detail"
                  className="mt-5 aspect-square w-[60%] shrink-0"
                />
              </div>
            </div>
          </div>

          {/* Panel 3 - Our Story */}
          <div className="flex h-full w-screen flex-shrink-0">
            <div className="relative w-[55%] overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?w=1200&h=1600&fit=crop&q=80"
                alt="Our story"
                className="parallax-img absolute inset-0 h-full w-[120%] max-w-none object-cover"
                style={{ left: "-10%" }}
              />
            </div>
            <div className="flex flex-1 flex-col justify-center gap-5 px-12 md:px-16">
              <div>
                <p className="mb-4 text-xs font-medium tracking-widest text-dark/40 uppercase">
                  Our Story
                </p>
                <h2 className="text-48 mb-4 leading-tight font-medium">
                  Found in a Tokyo flea market
                </h2>
                <p className="text-sm leading-relaxed text-dark/60">
                  It began in 2021 with a box of mid-century Japanese matchbooks from a
                  Shimokitazawa market - tiny, perfect labels unlike anything in any gallery. We've
                  been hunting ever since.
                </p>
              </div>
              <RevealImage
                src="https://images.unsplash.com/photo-1598048851887-0263d4f43e73?w=1000&h=1000&fit=crop&q=80"
                alt="Stryk detail"
                className="aspect-square w-full shrink-0"
              />
            </div>
          </div>

          {/* Panel 4 - Values */}
          <div className="flex h-full w-screen flex-shrink-0 flex-col justify-center px-6 md:px-10">
            <p className="mb-14 text-xs font-medium tracking-widest text-dark/40 uppercase">
              What we stand for
            </p>
            <div className="grid grid-cols-4 items-stretch divide-x divide-dark/10 border-t border-dark/10 pt-12">
              {VALUES.map((v) => (
                <div
                  key={v.label}
                  onMouseEnter={() => setHoveredValue(v.label)}
                  onMouseLeave={() => setHoveredValue(null)}
                  className="flex cursor-default flex-col px-8 py-6"
                >
                  <h3
                    className={clsx(
                      "text-48 mb-5 font-medium transition-opacity duration-400",
                      hoveredValue !== null && hoveredValue !== v.label
                        ? "opacity-30"
                        : "opacity-100",
                    )}
                  >
                    {v.label}
                  </h3>
                  <p
                    className={clsx(
                      "mb-8 text-sm leading-relaxed text-dark/55 transition-opacity duration-300",
                      hoveredValue === v.label ? "opacity-100" : "opacity-0",
                    )}
                  >
                    {v.body}
                  </p>
                  <RevealImage
                    src={v.image}
                    alt={v.label}
                    className="mt-auto aspect-square w-full shrink-0"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Vertical: Sustainability ── */}
      <section className="px-6 py-24 md:px-10">
        <p className="mb-4 text-xs font-medium tracking-widest text-dark/50 uppercase">
          Sustainability
        </p>
        <h2 className="text-64 mb-12 font-medium">How we work</h2>
        <Accordion items={SUSTAINABILITY_ITEMS} />
      </section>

      <Footer />
    </div>
  )
}
