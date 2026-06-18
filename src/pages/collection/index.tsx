import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { Footer } from "../../components/ui/footer"
import { Navbar } from "../../components/ui/navbar"
import { useLenis } from "../../hooks/use-lenis"
import { getCollection } from "../../lib/demo-data"
import { gsap, ScrollTrigger } from "../../lib/gsap"

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-dark/15 py-4">
      <span className="text-sm text-dark/50">{label}</span>
      <span className="text-sm font-medium text-dark">{value}</span>
    </div>
  )
}

// Fixed spots arranging the closing artworks around the centred collection name.
const SPOTS: {
  top?: string
  bottom?: string
  left?: string
  right?: string
  w: string
  r: number
}[] = [
  { top: "3%", left: "4%", w: "13vw", r: -4 },
  { top: "-3%", left: "27%", w: "20vw", r: 2 },
  { top: "5%", left: "53%", w: "14vw", r: -3 },
  { top: "2%", right: "4%", w: "13vw", r: 5 },
  { top: "40%", left: "1%", w: "15vw", r: 3 },
  { top: "44%", right: "2%", w: "14vw", r: -2 },
  { bottom: "3%", left: "9%", w: "16vw", r: -5 },
  { bottom: "-3%", left: "45%", w: "18vw", r: 2 },
  { bottom: "5%", right: "9%", w: "13vw", r: 4 },
]

export function CollectionPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const collection = useMemo(() => (slug ? getCollection(slug) : null), [slug])

  useLenis(!!collection)

  const pinRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const panel1Ref = useRef<HTMLDivElement>(null)
  const bigImgRef = useRef<HTMLImageElement>(null)
  const framedWrapRef = useRef<HTMLDivElement>(null)
  const framedMaskRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const closingRef = useRef<HTMLElement>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)

  const products = useMemo(() => collection?.products ?? [], [collection])
  const heroImage = products[0]?.image ?? ""
  const galleryImages = useMemo(() => products.flatMap((p) => p.images ?? [p.image]), [products])

  // Horizontal scroll: pin the intro section and translate its track sideways
  // as the user scrolls, then release into the static closing screen below.
  // The sideways motion is a scrubbed tween so the per-panel reveals can hook
  // into its progress via `containerAnimation`.
  useEffect(() => {
    if (!collection) return
    const pin = pinRef.current
    const track = trackRef.current
    if (!pin || !track) return

    const ctx = gsap.context(() => {
      const getDist = () => Math.max(track.scrollWidth - window.innerWidth, 0)

      const horizontal = gsap.to(track, {
        x: () => -getDist(),
        ease: "none",
        scrollTrigger: {
          trigger: pin,
          start: "top top",
          end: () => `+=${getDist()}`,
          pin: true,
          scrub: true,
          invalidateOnRefresh: true,
        },
      })

      // 1 ── First panel: the familiar blur-in on entrance.
      if (panel1Ref.current) {
        gsap.from(panel1Ref.current, {
          opacity: 0,
          filter: "blur(14px)",
          y: 24,
          duration: 1.1,
          ease: "power3.out",
          delay: 0.15,
        })
      }

      // 2 ── Big image: horizontal parallax drag as it scrolls past.
      if (bigImgRef.current) {
        gsap.fromTo(
          bigImgRef.current,
          { xPercent: 0 },
          {
            xPercent: -15,
            ease: "none",
            scrollTrigger: {
              trigger: bigImgRef.current,
              containerAnimation: horizontal,
              start: "left right",
              end: "right left",
              scrub: true,
            },
          },
        )
      }

      // 3 ── Framed image: a mask that wipes upward to reveal it.
      if (framedWrapRef.current && framedMaskRef.current) {
        ScrollTrigger.create({
          trigger: framedWrapRef.current,
          containerAnimation: horizontal,
          start: "left 80%",
          onEnter: () =>
            gsap.to(framedMaskRef.current, {
              yPercent: -100,
              duration: 1.1,
              ease: "power3.inOut",
            }),
        })
      }

      // 4 ── "Products from this collection" heading: blur in.
      if (headingRef.current) {
        gsap.set(headingRef.current, { opacity: 0, filter: "blur(12px)", y: 20 })
        ScrollTrigger.create({
          trigger: headingRef.current,
          containerAnimation: horizontal,
          start: "left 82%",
          onEnter: () =>
            gsap.to(headingRef.current, {
              opacity: 1,
              filter: "blur(0px)",
              y: 0,
              duration: 0.9,
              ease: "power3.out",
            }),
        })
      }

      // 5 ── Featured products: staggered blur-in, one by one.
      if (gridRef.current) {
        const cards = gridRef.current.querySelectorAll<HTMLElement>("[data-product-card]")
        gsap.set(cards, { opacity: 0, filter: "blur(12px)", y: 24, scale: 0.97 })
        ScrollTrigger.create({
          trigger: gridRef.current,
          containerAnimation: horizontal,
          start: "left 72%",
          onEnter: () =>
            gsap.to(cards, {
              opacity: 1,
              filter: "blur(0px)",
              y: 0,
              scale: 1,
              duration: 0.7,
              ease: "power3.out",
              stagger: 0.1,
            }),
        })
      }

      // 6 ── Closing screen: images blur in one by one, then the centre text.
      if (closingRef.current) {
        const imgs = closingRef.current.querySelectorAll<HTMLElement>("[data-closing-img]")
        const text = closingRef.current.querySelector<HTMLElement>("[data-closing-text]")
        gsap.set(imgs, { opacity: 0, filter: "blur(14px)", scale: 0.9 })
        if (text) gsap.set(text, { opacity: 0, filter: "blur(12px)", y: 24 })
        ScrollTrigger.create({
          trigger: closingRef.current,
          start: "top 72%",
          onEnter: () => {
            const tl = gsap.timeline()
            tl.to(imgs, {
              opacity: 1,
              filter: "blur(0px)",
              scale: 1,
              duration: 0.7,
              ease: "power3.out",
              stagger: 0.12,
            })
            if (text)
              tl.to(
                text,
                { opacity: 1, filter: "blur(0px)", y: 0, duration: 0.9, ease: "power3.out" },
                "-=0.15",
              )
          },
        })
      }
    })

    const refresh = () => ScrollTrigger.refresh()
    const t = window.setTimeout(refresh, 400)
    window.addEventListener("load", refresh)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener("load", refresh)
      ctx.revert()
    }
  }, [collection])

  // Escape closes the lightbox.
  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [lightbox])

  if (!collection) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 bg-canvas text-dark">
        <p className="text-128">Collection not found</p>
        <button
          onClick={() => navigate("/")}
          className="rounded-lg bg-dark px-6 py-3 text-sm font-medium text-white"
        >
          Back home
        </button>
      </div>
    )
  }

  return (
    <div className="bg-canvas text-dark">
      <Navbar />

      {/* ── Horizontal intro ───────────────────────────────────────────── */}
      <section ref={pinRef} className="h-screen overflow-hidden">
        <div ref={trackRef} className="flex h-screen will-change-transform">
          {/* Panel 1 — collection identity + specs */}
          <div ref={panel1Ref} className="relative flex h-screen w-screen shrink-0">
            <div className="h-full w-1/2 shrink-0 overflow-hidden">
              <img src={heroImage} alt={collection.name} className="h-full w-full object-cover" />
            </div>
            <div className="relative flex w-1/2 shrink-0 flex-col justify-between px-8 py-24 md:px-16">
              <div>
                <h1 className="text-128 leading-[0.95] text-dark">{collection.name}</h1>
                <p className="mt-6 max-w-md text-lg text-dark/70">{collection.tagline}</p>
              </div>
              <div className="max-w-md">
                <p className="mb-2 text-xs font-medium tracking-widest text-dark/40 uppercase">
                  Specifications
                </p>
                <Spec label="Products" value={String(products.length)} />
                <Spec label="Materials" value={collection.materials} />
                <Spec label="Color palette" value={collection.palette} />
              </div>
              {products[1] && (
                <img
                  src={products[1].image}
                  alt=""
                  className="absolute top-1/2 right-8 hidden aspect-square w-48 -translate-y-1/2 object-cover shadow-xl shadow-dark/10 md:right-16 md:block lg:w-64"
                />
              )}
            </div>
          </div>

          {/* Panel 2 — full-bleed imagery */}
          <div className="flex h-screen shrink-0 items-stretch">
            <div className="h-full w-[58vw] shrink-0 overflow-hidden">
              <img
                ref={bigImgRef}
                src={products[2]?.image ?? heroImage}
                alt=""
                className="h-full w-[120%] max-w-none object-cover will-change-transform"
              />
            </div>
            <div className="w-[8vw] shrink-0" />
            <div
              ref={framedWrapRef}
              className="relative my-auto h-[68vh] w-[34vw] shrink-0 overflow-hidden rounded-sm shadow-2xl shadow-dark/15"
            >
              <img
                src={products[3]?.image ?? heroImage}
                alt=""
                className="h-full w-full object-cover"
              />
              <div ref={framedMaskRef} className="image-mask" />
            </div>
            <div className="w-[8vw] shrink-0" />
          </div>

          {/* Panel 3 — featured products, laid out horizontally */}
          <div className="flex h-screen w-screen shrink-0 items-center px-8 md:px-16">
            <div ref={gridRef} className="mx-auto grid w-full max-w-5xl grid-cols-3 items-start gap-x-8 gap-y-5">
              <div className="flex items-start pt-10">
                <h2
                  ref={headingRef}
                  className="font-sans text-[2rem] leading-tight font-medium text-dark"
                >
                  Products from this collection
                </h2>
              </div>
              {products.map((product) => (
                <div key={product.id} data-product-card className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => setLightbox(product.image)}
                    aria-label={`Expand ${product.name}`}
                    className="group relative aspect-square w-full rounded-xl border border-dark/15 transition-colors hover:border-dark/30"
                  >
                    <span className="absolute inset-0 flex items-center justify-center p-[14%]">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="max-h-full max-w-full object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.16)]"
                      />
                    </span>
                    <span className="absolute top-3 right-3 text-dark/40 transition-all duration-300 group-hover:scale-110 group-hover:text-dark">
                      <ExpandIcon />
                    </span>
                  </button>
                  <p className="mt-3 text-sm text-dark/70">{product.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Break before the closing screen */}
      <div className="h-[14vh]" />

      {/* ── Closing screen — static, artworks around the collection name ── */}
      <section
        ref={closingRef}
        className="relative flex h-screen items-center justify-center overflow-hidden px-6"
      >
        {SPOTS.map((s, i) => (
          <img
            key={i}
            data-closing-img
            src={galleryImages[i % Math.max(galleryImages.length, 1)]}
            alt=""
            loading="lazy"
            className="absolute aspect-square rounded-sm object-cover shadow-xl shadow-dark/10"
            style={{
              top: s.top,
              bottom: s.bottom,
              left: s.left,
              right: s.right,
              width: s.w,
            }}
          />
        ))}
        <div data-closing-text className="relative z-10 max-w-2xl text-center">
          <h2 className="text-128 leading-[0.95] text-dark">{collection.name}</h2>
          <p className="mx-auto mt-5 max-w-md text-base text-dark/60">{collection.tagline}</p>
        </div>
      </section>

      {/* Breathing room between the closing imagery and the footer */}
      <div className="h-[16vh]" />

      <Footer />

      {/* ── Lightbox ───────────────────────────────────────────────────── */}
      {lightbox && (
        <button
          type="button"
          onClick={() => setLightbox(null)}
          aria-label="Close image"
          className="lightbox-backdrop fixed inset-0 z-[2000] flex items-center justify-center bg-dark/85 p-8 backdrop-blur-sm"
        >
          <img
            src={lightbox}
            alt=""
            className="lightbox-image max-h-[85vh] max-w-[85vw] rounded-sm object-contain shadow-2xl"
          />
        </button>
      )}
    </div>
  )
}
