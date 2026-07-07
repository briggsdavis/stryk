import { useQuery } from "convex/react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router"
import { api } from "../../../convex/_generated/api"
import { CollectionProductCard } from "../../components/collection/collection-product-card"
import { Footer } from "../../components/ui/footer"
import { HoverLabel } from "../../components/ui/hover-label"
import { Navbar } from "../../components/ui/navbar"
import { useLenis } from "../../hooks/use-lenis"
import { useArtworkFocus } from "../../lib/artwork-focus"
import { catalogProductToProduct } from "../../lib/catalog"
import { gsap, ScrollTrigger } from "../../lib/gsap"
import { useTransitionNavigate } from "../../lib/transition"

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-dark/15 py-4">
      <span className="text-sm text-dark/50">{label}</span>
      <span className="text-sm font-medium text-dark">{value}</span>
    </div>
  )
}

function hasFourImages(images: string[]): images is [string, string, string, string] {
  return images.length === 4 && images.every(Boolean)
}

const CLOSING_ARTWORK_COUNT = 12
const CLOSING_ARTWORK_SAFE_INSET = 8
const CLOSING_ARTWORK_GAP = 28
const CLOSING_ARTWORK_CHORD_FILL = 0.96

type ClosingArtworkStyle = {
  left: number
  top: number
  width: number
}

type ClosingImageProduct = {
  image: string
  images?: string[]
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function distanceToRectEdge(halfWidth: number, halfHeight: number, angle: number) {
  const x = Math.abs(Math.cos(angle))
  const y = Math.abs(Math.sin(angle))
  return Math.min(
    x > 0.001 ? halfWidth / x : Number.POSITIVE_INFINITY,
    y > 0.001 ? halfHeight / y : Number.POSITIVE_INFINITY,
  )
}

function computeClosingArtworkStyles(
  section: HTMLElement,
  text: HTMLElement,
  count: number,
): ClosingArtworkStyle[] {
  if (count === 0) return []

  const sectionRect = section.getBoundingClientRect()
  const textRect = text.getBoundingClientRect()
  const centerX = sectionRect.width / 2
  const centerY = sectionRect.height / 2
  const shortestSide = Math.min(sectionRect.width, sectionRect.height)
  const safeInset = Math.min(CLOSING_ARTWORK_SAFE_INSET, shortestSide * 0.08)
  const gap = clamp(shortestSide * 0.035, 18, CLOSING_ARTWORK_GAP)
  const angles = Array.from(
    { length: count },
    (_, index) => -Math.PI / 2 + (index / count) * Math.PI * 2,
  )
  const boundsHalfWidth = Math.max(centerX - safeInset, 0)
  const boundsHalfHeight = Math.max(centerY - safeInset, 0)
  const textHalfWidth = textRect.width / 2
  const textHalfHeight = textRect.height / 2
  const minSize = clamp(shortestSide * 0.14, 92, 144)
  const maxSize = clamp(shortestSide * 0.22, 140, 255)

  let imageSize = minSize
  let radius = Math.max(shortestSide * 0.3, 0)
  let foundFit = false

  for (let size = maxSize; size >= minSize; size -= 2) {
    const requiredRadius =
      Math.max(...angles.map((angle) => distanceToRectEdge(textHalfWidth, textHalfHeight, angle))) +
      size / 2 +
      gap
    const maxRadius =
      Math.min(
        ...angles.map((angle) => distanceToRectEdge(boundsHalfWidth, boundsHalfHeight, angle)),
      ) -
      size / 2
    const nextRadius = maxRadius
    const chord = count > 1 ? 2 * nextRadius * Math.sin(Math.PI / count) : Number.POSITIVE_INFINITY

    if (requiredRadius <= maxRadius && size <= chord * CLOSING_ARTWORK_CHORD_FILL) {
      imageSize = size
      radius = nextRadius
      foundFit = true
      break
    }
  }

  if (!foundFit) {
    const maxRadius =
      Math.min(
        ...angles.map((angle) => distanceToRectEdge(boundsHalfWidth, boundsHalfHeight, angle)),
      ) -
      minSize / 2
    radius = Math.max(maxRadius, 0)
  }

  return angles.map((angle) => ({
    left: centerX + Math.cos(angle) * radius,
    top: centerY + Math.sin(angle) * radius,
    width: imageSize,
  }))
}

function selectClosingImages(products: ClosingImageProduct[], count: number) {
  const selected: string[] = []
  const seen = new Set<string>()
  const add = (src: string | undefined) => {
    if (!src || seen.has(src)) return
    seen.add(src)
    selected.push(src)
  }

  for (const imageIndex of [1, 2, 3, 0]) {
    for (const product of products) {
      add(product.images?.[imageIndex] ?? (imageIndex === 0 ? product.image : undefined))
      if (selected.length >= count) return selected
    }
  }

  const uniqueImages = products
    .flatMap((product) => product.images ?? [product.image])
    .filter((src) => {
      if (seen.has(src)) return false
      seen.add(src)
      return true
    })
  const reusableImages = [...selected, ...uniqueImages]

  while (selected.length < count && reusableImages.length > 0) {
    selected.push(reusableImages[selected.length % reusableImages.length])
  }

  return selected
}

// The horizontal panel shows the heading plus seven products; "View more"
// continues the same collection grid below.
const FEATURED_COUNT = 7

function announcementBarHeight() {
  return (
    Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--announcement-bar-height"),
    ) || 0
  )
}

export function CollectionPage() {
  const { slug } = useParams<{ slug: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const transitionNavigate = useTransitionNavigate()
  const collectionResult = useQuery(
    api.catalog.getCollection,
    slug ? { handle: slug, productLimit: 60 } : "skip",
  )
  const collection = useMemo(() => {
    if (!collectionResult) return collectionResult
    return {
      slug: collectionResult.collection.shopifyHandle,
      name: collectionResult.collection.title,
      color: collectionResult.collection.palette ?? "#f0ede6",
      tagline: collectionResult.collection.tagline ?? collectionResult.collection.description ?? "",
      description: collectionResult.collection.description ?? "",
      materials: collectionResult.collection.materials ?? "",
      palette: collectionResult.collection.palette ?? "Beige",
      isConfigured: collectionResult.pageSettings !== null,
      pageImages: collectionResult.pageSettings?.heroImages.map((image) => image.url) ?? [],
      specs: collectionResult.pageSettings?.specs ?? [],
      products: collectionResult.products.map((product) => ({
        ...catalogProductToProduct(product),
        collectionName: collectionResult.collection.title,
        collectionSlug: collectionResult.collection.shopifyHandle,
      })),
    }
  }, [collectionResult])
  const { focusedProduct, openProduct } = useArtworkFocus()

  // Pause smooth-scroll while a product is focused so wheel input drives the
  // focus gallery (advancing between a product's images) instead of the page.
  useLenis(!!collection && collection.isConfigured && !focusedProduct)

  const pinRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const panel1Ref = useRef<HTMLDivElement>(null)
  const bigImgRef = useRef<HTMLImageElement>(null)
  const framedWrapRef = useRef<HTMLDivElement>(null)
  const framedImgRef = useRef<HTMLImageElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const closingRef = useRef<HTMLElement>(null)
  const closingTextRef = useRef<HTMLDivElement>(null)
  const productImageRefs = useRef<Map<string, HTMLImageElement>>(new Map())
  const reopenedArtworkRef = useRef<string | null>(null)

  const products = useMemo(() => collection?.products ?? [], [collection])
  const featuredProducts = useMemo(() => products.slice(0, FEATURED_COUNT), [products])
  const moreProducts = useMemo(() => products.slice(FEATURED_COUNT), [products])
  const [showMore, setShowMore] = useState(false)
  const moreGridRef = useRef<HTMLDivElement>(null)
  const closingImages = useMemo(
    () => selectClosingImages(products, CLOSING_ARTWORK_COUNT),
    [products],
  )
  const [closingArtworkStyles, setClosingArtworkStyles] = useState<ClosingArtworkStyle[]>([])
  const skipIntroAnimation =
    (location.state as { skipCollectionIntro?: boolean } | null)?.skipCollectionIntro === true
  const whiteRevealRef = useRef<HTMLDivElement>(null)
  const [showWhiteReveal, setShowWhiteReveal] = useState(skipIntroAnimation)

  useLayoutEffect(() => {
    if (!collection?.isConfigured || closingImages.length === 0) {
      setClosingArtworkStyles([])
      return
    }

    const section = closingRef.current
    const text = closingTextRef.current
    if (!section || !text) return

    let frame = 0
    const update = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        setClosingArtworkStyles(computeClosingArtworkStyles(section, text, closingImages.length))
      })
    }

    update()

    const observer = new ResizeObserver(update)
    observer.observe(section)
    observer.observe(text)
    window.addEventListener("resize", update)

    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener("resize", update)
    }
  }, [closingImages.length, collection?.isConfigured, collection?.name, collection?.tagline])

  // Horizontal scroll: pin the intro section and translate its track sideways
  // as the user scrolls, then release into the static closing screen below.
  // The sideways motion is a scrubbed tween so the per-panel reveals can hook
  // into its progress via `containerAnimation`.
  useEffect(() => {
    if (!collection?.isConfigured) return
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
          start: () => `top top+=${announcementBarHeight()}`,
          end: () => `+=${getDist()}`,
          pin: true,
          scrub: true,
          invalidateOnRefresh: true,
        },
      })

      // 1 ── First panel: the familiar blur-in on entrance.
      if (panel1Ref.current && !skipIntroAnimation) {
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

      // 3 ── Framed image: clip-wipe upward so it appears from nothing
      // (no dark overlay — the image itself reveals from the bottom up).
      if (framedWrapRef.current && framedImgRef.current) {
        gsap.set(framedImgRef.current, { clipPath: "inset(100% 0% 0% 0%)" })
        ScrollTrigger.create({
          trigger: framedWrapRef.current,
          containerAnimation: horizontal,
          start: "left 80%",
          onEnter: () =>
            gsap.to(framedImgRef.current, {
              clipPath: "inset(0% 0% 0% 0%)",
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
  }, [closingImages.length, collection, skipIntroAnimation])

  // Collapse the "View more" grid when navigating to a different collection.
  useEffect(() => {
    setShowMore(false)
  }, [slug])

  // Blur the extra products in one by one as the grid expands, then let the
  // pinned closing screen recompute its trigger against the taller page.
  useEffect(() => {
    if (!showMore || !moreGridRef.current) return
    const cards = moreGridRef.current.querySelectorAll<HTMLElement>("[data-more-card]")
    gsap.fromTo(
      cards,
      { opacity: 0, y: 24, filter: "blur(12px)", scale: 0.97 },
      {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        scale: 1,
        duration: 0.6,
        ease: "power3.out",
        stagger: 0.08,
      },
    )
    ScrollTrigger.refresh()
  }, [showMore])

  useEffect(() => {
    if (!showWhiteReveal || !collection?.isConfigured) return
    const overlay = whiteRevealRef.current
    if (!overlay) return

    const tween = gsap.to(overlay, {
      opacity: 0,
      duration: 1,
      ease: "power2.out",
      onComplete: () => setShowWhiteReveal(false),
    })
    return () => {
      tween.kill()
    }
  }, [collection?.isConfigured, showWhiteReveal])

  useEffect(() => {
    if (typeof window === "undefined" || focusedProduct || !collection) return

    const slug = new URLSearchParams(window.location.search).get("artwork")
    if (!slug || reopenedArtworkRef.current === slug) return

    const product = products.find((p) => p.slug === slug)
    if (!product) return

    const isMoreProduct = moreProducts.some((p) => p.id === product.id)
    if (isMoreProduct && !showMore) {
      setShowMore(true)
      return
    }

    const img = productImageRefs.current.get(product.id)
    if (!img) return

    reopenedArtworkRef.current = slug
    openProduct(product, img, isMoreProduct ? undefined : pinRef.current)
  }, [collection, focusedProduct, moreProducts, openProduct, products, showMore])

  if (collection === undefined) {
    return <div className={`h-screen text-dark ${showWhiteReveal ? "bg-white" : "bg-canvas"}`} />
  }

  if (collection === null) {
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

  if (!collection.isConfigured || !hasFourImages(collection.pageImages)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 bg-canvas text-dark">
        <p className="text-64">Collection page not configured</p>
      </div>
    )
  }

  const [heroImage, specImage, bigImage, framedImage] = collection.pageImages

  return (
    <div className="bg-canvas text-dark">
      {showWhiteReveal && <div ref={whiteRevealRef} className="fixed inset-0 z-[3000] bg-white" />}
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
                {collection.specs.map((spec, index) => (
                  <Spec key={`${index}-${spec.label}`} label={spec.label} value={spec.value} />
                ))}
                <img
                  src={specImage}
                  alt=""
                  className="mt-6 aspect-[16/9] w-full object-cover shadow-xl shadow-dark/10"
                />
              </div>
            </div>
          </div>

          {/* Panel 2 — full-bleed imagery */}
          <div className="flex h-screen shrink-0 items-stretch">
            <div className="mr-44 h-full w-[58vw] shrink-0 overflow-hidden py-8">
              <img
                ref={bigImgRef}
                src={bigImage}
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
                ref={framedImgRef}
                src={framedImage}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <div className="w-[8vw] shrink-0" />
          </div>

          {/* Panel 3 — featured products, laid out horizontally */}
          <div className="flex h-screen w-screen shrink-0 items-center px-8 md:px-16">
            <div
              ref={gridRef}
              className="mx-auto grid w-full max-w-6xl grid-cols-4 items-start gap-x-6 gap-y-6"
            >
              <div className="flex items-start pt-10">
                <h2
                  ref={headingRef}
                  className="font-sans text-[2rem] leading-tight font-medium text-dark"
                >
                  Products from this collection
                </h2>
              </div>
              {featuredProducts.map((product) => (
                <div key={product.id} data-product-card>
                  {/* Slide the pinned section aside (it's the fixed element, so it
                      can be translated directly) as the image morphs in. */}
                  <CollectionProductCard
                    product={product}
                    itemRef={(img) => {
                      if (img) productImageRefs.current.set(product.id, img)
                      else productImageRefs.current.delete(product.id)
                    }}
                    onOpen={(p, img) => openProduct(p, img, pinRef.current)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── View more — continue the collection grid in normal page flow ── */}
      {moreProducts.length > 0 && (
        <section className={`px-6 pb-16 md:px-16 ${showMore ? "-mt-24 pt-0" : "-mt-12 pt-16"}`}>
          <div className="mx-auto max-w-6xl">
            {!showMore ? (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowMore(true)}
                  aria-expanded={false}
                  className="group inline-flex items-center gap-2 rounded-lg border border-dark/20 px-5 py-3 text-sm font-medium text-dark transition-colors hover:border-dark/40"
                >
                  <HoverLabel>View more</HoverLabel>
                  <span className="text-dark/50 transition-transform duration-300 group-hover:translate-y-0.5">
                    ↓
                  </span>
                </button>
              </div>
            ) : (
              <div
                ref={moreGridRef}
                className="grid grid-cols-2 items-start gap-x-6 gap-y-6 md:grid-cols-4"
              >
                {moreProducts.map((product) => (
                  <div key={product.id} data-more-card>
                    {/* No background to slide aside here (normal vertical flow) -
                        the focus panel simply morphs in over the left-hand side. */}
                    <CollectionProductCard
                      product={product}
                      itemRef={(img) => {
                        if (img) productImageRefs.current.set(product.id, img)
                        else productImageRefs.current.delete(product.id)
                      }}
                      onOpen={(p, img) => openProduct(p, img)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Break before the closing screen */}
      <div className="h-[14vh]" />

      {/* ── Closing screen — artworks evenly computed around the collection name ── */}
      <section
        ref={closingRef}
        className="relative flex items-center justify-center overflow-hidden"
        style={{ height: "150vh" }}
      >
        {closingImages.map((src, i) => {
          const style = closingArtworkStyles[i] ?? {
            left: 0,
            top: 0,
            width: 0,
          }

          return (
            <div
              key={`${src}-${i}`}
              className="absolute aspect-square"
              style={{
                left: style.left,
                top: style.top,
                width: style.width,
                transform: "translate(-50%, -50%)",
              }}
            >
              <img
                data-closing-img
                src={src}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover opacity-0"
              />
            </div>
          )
        })}
        <div
          ref={closingTextRef}
          data-closing-text
          className="relative z-10 max-w-2xl px-6 text-center"
        >
          <h2 className="text-128 leading-[0.95] text-dark">{collection.name}</h2>
          <p className="mx-auto mt-5 max-w-md text-base text-dark/60">{collection.tagline}</p>
          <Link
            to="/collections"
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
              transitionNavigate("/collections")
            }}
            className="group mt-4 inline-flex items-center gap-1.5 rounded-lg border border-dark/20 px-4 py-2.5 text-sm font-medium text-dark transition-colors hover:border-dark/40"
          >
            <HoverLabel>Explore collections</HoverLabel>
            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </Link>
        </div>
      </section>

      {/* Breathing room between the closing imagery and the footer */}
      <div className="h-[16vh]" />

      <Footer />
    </div>
  )
}
