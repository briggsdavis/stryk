import { clsx } from "clsx"
import { useEffect, useRef, useState } from "react"
import { Accordion } from "../../components/ui/accordion"
import { Footer } from "../../components/ui/footer"
import { Navbar } from "../../components/ui/navbar"
import { useMediaQuery } from "../../hooks/use-is-mobile"
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

  // Desktop (≥1024px) gets the horizontal scroll-jacked panels. Mobile + tablet
  // stack the panels vertically so each section has room to breathe.
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  // Hover-to-reveal only makes sense with a hover-capable pointer; touch devices
  // show the value copy by default.
  const canHover = useMediaQuery("(hover: hover) and (pointer: fine)")

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
      if (!isDesktop) {
        // Vertical layout: reveal each square image with its own upward wipe as it
        // scrolls into view (no horizontal container animation to hook into).
        const masks = gsap.utils.toArray<HTMLElement>(".reveal-mask")
        masks.forEach((mask) => {
          const wrap = mask.parentElement
          if (!wrap) return
          gsap.set(mask, { yPercent: 0 })
          ScrollTrigger.create({
            trigger: wrap,
            start: "top 85%",
            once: true,
            onEnter: () => gsap.to(mask, { yPercent: -100, duration: 1.0, ease: "power3.inOut" }),
          })
        })
        return
      }

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
  }, [isDesktop])

  return (
    <div className="bg-canvas text-dark">
      <Navbar />

      {/* ── Hero ── */}
      <section className="px-6 pt-28 pb-12 md:px-10 md:pt-32">
        <div className="group mb-8 overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1600&q=80"
            alt="Stryk Studios"
            className="h-[38vh] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />
        </div>
        <p className="mb-4 text-xs font-medium tracking-widest text-dark/40 uppercase">
          About Stryk Studios
        </p>
        <h1
          ref={h1Ref}
          className="text-128 max-w-4xl overflow-hidden pb-3 leading-none font-medium"
        >
          Vintage charm, modern walls
        </h1>
      </section>

      {/* ── Horizontal scroll (desktop) / stacked sections (mobile + tablet) ── */}
      <div ref={horizontalRef} className="lg:h-screen lg:overflow-hidden">
        <div
          ref={trackRef}
          className="flex flex-col lg:h-full lg:flex-row"
          style={isDesktop ? { width: `${NUM_PANELS * 100}vw` } : undefined}
        >
          {/* Panel 1 - Philosophy */}
          <div className="flex w-full flex-shrink-0 flex-col items-center gap-10 px-6 py-16 md:px-10 lg:h-full lg:w-screen lg:flex-row lg:gap-16 lg:py-0">
            {/* On desktop the panel is pinned to the top of the viewport, so the copy
                is top-aligned and padded down just past the fixed nav logo (its base
                sits ~3.5rem from the top) rather than vertically centered. */}
            <div className="flex w-full flex-1 flex-col justify-center lg:w-auto lg:self-start lg:justify-start lg:pt-[4.5rem]">
              <p className="mb-4 text-xs font-medium tracking-widest text-dark/40 uppercase">
                Our Philosophy
              </p>
              <p className="max-w-sm text-sm leading-relaxed text-dark/55">
                Stryk Studios sources matchboxes and matchbooks from flea markets, estate sales, and
                specialist dealers across four continents - and brings the best of them home as art.
              </p>
              <p className="mt-8 text-xs tracking-widest text-dark/25 uppercase">
                Est. 2021 - New York
              </p>
            </div>
            <div className="grid w-full grid-cols-2 gap-4 lg:flex lg:w-[34%] lg:flex-col">
              <RevealImage
                src="https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=900&h=900&fit=crop&q=80"
                alt="Stryk Studios ceramics"
                className="aspect-square w-full"
              />
              <RevealImage
                src="https://images.unsplash.com/photo-1597696929736-6d13bed8e6a8?w=900&h=900&fit=crop&q=80"
                alt="Stryk Studios craft"
                className="aspect-square w-full"
              />
            </div>
          </div>

          {/* Panel 2 - Vision & Mission */}
          <div className="flex w-full flex-shrink-0 flex-col justify-center gap-6 px-6 py-16 md:px-10 lg:h-full lg:w-screen lg:py-0">
            <p className="text-xs font-medium tracking-widest text-dark/40 uppercase">
              What drives us
            </p>
            <div className="grid grid-cols-1 gap-10 border-t border-dark/10 pt-6 sm:grid-cols-2 lg:gap-16">
              <div className="flex flex-col">
                <h3 className="mb-3 text-xs font-medium tracking-widest text-dark/40 uppercase">
                  Vision
                </h3>
                <p className="text-[1.2rem] leading-tight font-light">
                  Everyday objects, recognised as the art they always were.
                </p>
                <RevealImage
                  src="https://images.unsplash.com/photo-1610219171189-286769cc9b20?w=1000&h=1000&fit=crop&q=80"
                  alt="Stryk Studios collection"
                  className="mt-5 aspect-square w-full max-w-[16rem] shrink-0 lg:w-[60%] lg:max-w-none"
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
                  alt="Stryk Studios detail"
                  className="mt-5 aspect-square w-full max-w-[16rem] shrink-0 lg:w-[60%] lg:max-w-none"
                />
              </div>
            </div>
          </div>

          {/* Panel 3 - Our Story */}
          <div className="flex w-full flex-shrink-0 flex-col gap-8 px-6 py-16 md:px-10 lg:h-full lg:w-screen lg:flex-row lg:gap-0 lg:p-0">
            <div className="relative aspect-square w-full overflow-hidden lg:aspect-auto lg:h-full lg:w-[55%]">
              <img
                src="https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?w=1200&h=1600&fit=crop&q=80"
                alt="Our story"
                className="parallax-img h-full w-full max-w-none object-cover lg:absolute lg:top-0 lg:left-[-10%] lg:h-full lg:w-[120%]"
              />
              {/* Stryk Studios logo, as an emblem in the bottom-right corner with
                  padding from the edges. */}
              <img
                src="/stryk-logo-128.png"
                alt="Stryk Studios"
                className="pointer-events-none absolute right-5 bottom-5 z-10 h-8 w-8 md:right-8 md:bottom-8 md:h-10 md:w-10"
              />
            </div>
            <div className="flex flex-1 flex-col justify-center gap-8 lg:gap-5 lg:px-12 xl:px-16">
              <div>
                <p className="mb-4 text-xs font-medium tracking-widest text-dark/40 uppercase">
                  Our Story
                </p>
                <h2 className="text-48 mb-4 leading-tight font-medium">
                  Found in a Tokyo flea market
                </h2>
                <p className="max-w-prose text-sm leading-relaxed text-dark/60">
                  It began in 2021 with a box of mid-century Japanese matchbooks from a
                  Shimokitazawa market - tiny, perfect labels unlike anything in any gallery. We've
                  been hunting ever since.
                </p>
              </div>
              <RevealImage
                src="https://images.unsplash.com/photo-1598048851887-0263d4f43e73?w=1000&h=1000&fit=crop&q=80"
                alt="Stryk Studios detail"
                className="aspect-square w-full max-w-[20rem] shrink-0 lg:max-w-none"
              />
            </div>
          </div>

          {/* Panel 4 - Values */}
          <div className="flex w-full flex-shrink-0 flex-col justify-center px-6 py-16 md:px-10 lg:h-full lg:w-screen lg:py-0">
            <p className="mb-8 text-xs font-medium tracking-widest text-dark/40 uppercase lg:mb-14">
              What we stand for
            </p>
            <div className="grid grid-cols-1 gap-10 border-t border-dark/10 pt-8 sm:grid-cols-2 lg:grid-cols-4 lg:items-stretch lg:gap-0 lg:divide-x lg:divide-dark/10 lg:pt-12">
              {VALUES.map((v) => {
                const dimmed = canHover && hoveredValue !== null && hoveredValue !== v.label
                const bodyVisible = !canHover || hoveredValue === v.label
                return (
                  <div
                    key={v.label}
                    onMouseEnter={() => setHoveredValue(v.label)}
                    onMouseLeave={() => setHoveredValue(null)}
                    className="flex flex-col lg:px-8 lg:py-6"
                  >
                    <h3
                      className={clsx(
                        "text-48 mb-4 font-medium transition-opacity duration-400 lg:mb-5",
                        dimmed ? "opacity-30" : "opacity-100",
                      )}
                    >
                      {v.label}
                    </h3>
                    <p
                      className={clsx(
                        "mb-8 text-sm leading-relaxed text-dark/55 transition-opacity duration-300",
                        bodyVisible ? "opacity-100" : "opacity-0",
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
                )
              })}
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
