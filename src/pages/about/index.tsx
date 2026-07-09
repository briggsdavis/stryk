import { clsx } from "clsx"
import { useQuery } from "convex/react"
import { useEffect, useRef, useState } from "react"
import { api } from "../../../convex/_generated/api"
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

const NUM_PANELS = 4

export function AboutPage() {
  useLenis()
  const content = useQuery(api.pages.getAbout)

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

  useSplitReveal(h1Ref, [content?.updatedAt])

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
  }, [isDesktop, content?.updatedAt])

  if (content === undefined) return <div className="min-h-screen bg-canvas" />

  return (
    <div className="bg-canvas text-dark">
      <Navbar />

      {/* ── Hero ── */}
      <section className="px-6 pt-28 pb-12 md:px-10 md:pt-32">
        <div className="group mb-8 overflow-hidden">
          <img
            src={content.heroImage.url}
            alt="Stryk Studios"
            className="h-[38vh] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />
        </div>
        <p className="mb-4 text-xs font-medium tracking-widest text-dark/40 uppercase">
          {content.eyebrow}
        </p>
        <h1
          ref={h1Ref}
          className="text-128 max-w-4xl overflow-hidden pb-3 leading-none font-medium"
        >
          {content.heading}
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
            <div className="flex w-full flex-1 flex-col justify-center lg:w-auto lg:justify-start lg:self-start lg:pt-[4.5rem]">
              <p className="mb-4 text-xs font-medium tracking-widest text-dark/40 uppercase">
                {content.philosophyEyebrow}
              </p>
              <p className="max-w-sm text-sm leading-relaxed text-dark/55">
                {content.philosophyBody}
              </p>
              <p className="mt-8 text-xs tracking-widest text-dark/25 uppercase">
                {content.philosophyMeta}
              </p>
            </div>
            <div className="grid w-full grid-cols-2 gap-4 lg:flex lg:w-[34%] lg:flex-col">
              {content.philosophyImages.map((image, index) => (
                <RevealImage
                  key={`${image.url}-${index}`}
                  src={image.url}
                  alt={`${content.philosophyEyebrow} ${index + 1}`}
                  className="aspect-square w-full"
                />
              ))}
            </div>
          </div>

          {/* Panel 2 - Vision & Mission */}
          <div className="flex w-full flex-shrink-0 flex-col justify-center gap-6 px-6 py-16 md:px-10 lg:h-full lg:w-screen lg:py-0">
            <p className="text-xs font-medium tracking-widest text-dark/40 uppercase">
              {content.driversEyebrow}
            </p>
            <div className="grid grid-cols-1 gap-10 border-t border-dark/10 pt-6 sm:grid-cols-2 lg:gap-16">
              <div className="flex flex-col">
                <h3 className="mb-3 text-xs font-medium tracking-widest text-dark/40 uppercase">
                  {content.visionLabel}
                </h3>
                <p className="text-[1.2rem] leading-tight font-light">{content.visionBody}</p>
                <RevealImage
                  src={content.visionImage.url}
                  alt={content.visionLabel}
                  className="mt-5 aspect-square w-full max-w-[16rem] shrink-0 lg:w-[60%] lg:max-w-none"
                />
              </div>
              <div className="flex flex-col">
                <h3 className="mb-3 text-xs font-medium tracking-widest text-dark/40 uppercase">
                  {content.missionLabel}
                </h3>
                <p className="text-[1.2rem] leading-tight font-light">{content.missionBody}</p>
                <RevealImage
                  src={content.missionImage.url}
                  alt={content.missionLabel}
                  className="mt-5 aspect-square w-full max-w-[16rem] shrink-0 lg:w-[60%] lg:max-w-none"
                />
              </div>
            </div>
          </div>

          {/* Panel 3 - Our Story */}
          <div className="flex w-full flex-shrink-0 flex-col gap-8 px-6 py-16 md:px-10 lg:h-full lg:w-screen lg:flex-row lg:gap-0 lg:p-0">
            <div className="relative aspect-square w-full overflow-hidden lg:aspect-auto lg:h-full lg:w-[55%]">
              <img
                src={content.storyHeroImage.url}
                alt={content.storyEyebrow}
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
                  {content.storyEyebrow}
                </p>
                <h2 className="text-48 mb-4 leading-tight font-medium">{content.storyHeading}</h2>
                <p className="max-w-prose text-sm leading-relaxed text-dark/60">
                  {content.storyBody}
                </p>
              </div>
              <RevealImage
                src={content.storyDetailImage.url}
                alt={content.storyHeading}
                className="aspect-square w-full max-w-[20rem] shrink-0 lg:max-w-none"
              />
            </div>
          </div>

          {/* Panel 4 - Values */}
          <div className="flex w-full flex-shrink-0 flex-col justify-center px-6 py-16 md:px-10 lg:h-full lg:w-screen lg:py-0">
            <p className="mb-8 text-xs font-medium tracking-widest text-dark/40 uppercase lg:mb-14">
              {content.valuesEyebrow}
            </p>
            <div className="grid grid-cols-1 gap-10 border-t border-dark/10 pt-8 sm:grid-cols-2 lg:grid-cols-4 lg:items-stretch lg:gap-0 lg:divide-x lg:divide-dark/10 lg:pt-12">
              {content.values.map((v) => {
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
                      src={v.image.url}
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
          {content.sustainabilityEyebrow}
        </p>
        <h2 className="text-64 mb-12 font-medium">{content.sustainabilityHeading}</h2>
        <Accordion items={content.sustainabilityItems} />
      </section>

      <Footer />
    </div>
  )
}
