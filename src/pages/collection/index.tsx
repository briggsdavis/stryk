import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router"
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

export function CollectionPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const collection = useMemo(() => (slug ? getCollection(slug) : null), [slug])

  useLenis(!!collection)

  const pinRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)

  const products = useMemo(() => collection?.products ?? [], [collection])
  const heroImage = products[0]?.image ?? ""
  const galleryImages = useMemo(() => products.flatMap((p) => p.images ?? [p.image]), [products])

  // Scatter positions for the closing vertical canvas (deterministic).
  const scatter = useMemo(() => {
    const cols = ["6%", "30%", "54%", "74%", "16%", "62%", "40%", "82%", "2%"]
    const widths = [22, 16, 26, 14, 19, 24, 15, 20, 17]
    return galleryImages.slice(0, 16).map((src, i) => ({
      src,
      left: cols[i % cols.length],
      top: `${8 + i * 10.5}vh`,
      width: `${widths[i % widths.length]}vw`,
      rotate: (i % 2 === 0 ? 1 : -1) * ((i % 3) + 1),
    }))
  }, [galleryImages])

  // Horizontal scroll: pin the intro section and translate its track sideways
  // as the user scrolls, then release into normal vertical scroll below.
  useEffect(() => {
    if (!collection) return
    const pin = pinRef.current
    const track = trackRef.current
    if (!pin || !track) return

    const getDist = () => Math.max(track.scrollWidth - window.innerWidth, 0)
    const st = ScrollTrigger.create({
      trigger: pin,
      start: "top top",
      end: () => `+=${getDist()}`,
      pin: true,
      invalidateOnRefresh: true,
      onUpdate: (self) => gsap.set(track, { x: -getDist() * self.progress }),
    })

    const refresh = () => ScrollTrigger.refresh()
    const t = window.setTimeout(refresh, 400)
    window.addEventListener("load", refresh)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener("load", refresh)
      st.kill()
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
          <div className="relative flex h-screen w-screen shrink-0">
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

          {/* Panel 2 — full-bleed imagery + description */}
          <div className="flex h-screen shrink-0">
            <div className="h-full w-[70vw] shrink-0 overflow-hidden">
              <img
                src={products[2]?.image ?? heroImage}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <div className="relative flex h-full w-[55vw] shrink-0 items-end overflow-hidden p-12 md:p-20">
              <p className="max-w-md text-xl leading-relaxed text-dark/80">
                {collection.description}
              </p>
              {products[3] && (
                <img
                  src={products[3].image}
                  alt=""
                  className="absolute top-1/2 -right-24 aspect-square w-[34vw] -translate-y-1/2 rounded-sm object-cover shadow-2xl shadow-dark/15"
                />
              )}
            </div>
          </div>

          {/* Panel 3 — featured products */}
          <div className="relative flex h-screen w-screen shrink-0 items-center">
            {products[4] && (
              <img
                src={products[4].image}
                alt=""
                className="absolute top-1/3 -left-10 hidden aspect-square w-56 object-cover shadow-xl shadow-dark/10 lg:block"
              />
            )}
            <div className="ml-auto flex w-full max-w-5xl items-center gap-12 px-8 md:px-16">
              <h2 className="text-64 w-72 shrink-0 leading-tight font-medium text-dark">
                Products from this collection
              </h2>
              <div className="grid flex-1 grid-cols-2 gap-5">
                {products.map((product) => (
                  <div key={product.id} className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => setLightbox(product.image)}
                      aria-label={`Expand ${product.name}`}
                      className="group relative flex aspect-square items-center justify-center rounded-xl border border-dark/15 p-[12%] transition-colors hover:border-dark/30"
                    >
                      <img
                        src={product.image}
                        alt={product.name}
                        className="max-h-full max-w-full object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.16)]"
                      />
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
        </div>
      </section>

      {/* ── Closing vertical canvas ────────────────────────────────────── */}
      <section className="relative px-6 pt-24 pb-40 md:px-10">
        <div className="relative" style={{ height: `${scatter.length * 11 + 20}vh` }}>
          {scatter.map((item, i) => (
            <img
              key={i}
              src={item.src}
              alt=""
              loading="lazy"
              className="absolute aspect-square rounded-sm object-cover shadow-xl shadow-dark/10"
              style={{
                left: item.left,
                top: item.top,
                width: item.width,
                transform: `rotate(${item.rotate}deg)`,
              }}
            />
          ))}
          <div className="pointer-events-none sticky top-1/2 z-10 -translate-y-1/2 text-center">
            <p className="mb-3 text-xs font-medium tracking-widest text-dark/40 uppercase">
              The full collection
            </p>
            <h2 className="text-128 leading-[0.95] text-dark">{collection.name}</h2>
          </div>
        </div>
      </section>

      {/* ── Lightbox ───────────────────────────────────────────────────── */}
      {lightbox && (
        <button
          type="button"
          onClick={() => setLightbox(null)}
          aria-label="Close image"
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-dark/85 p-8 backdrop-blur-sm"
        >
          <img
            src={lightbox}
            alt=""
            className="max-h-[85vh] max-w-[85vw] rounded-sm object-contain shadow-2xl"
          />
        </button>
      )}
    </div>
  )
}
