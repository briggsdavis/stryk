import { clsx } from "clsx"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useIsMobile } from "../../hooks/use-is-mobile"
import { useShopifyCart } from "../../hooks/use-shopify-cart"
import { track } from "../../lib/analytics"
import { gsap } from "../../lib/gsap"
import { galleryIndexForImage, mediaKey } from "../../lib/gallery"
import { emitPopupAction } from "../../lib/marketing"
import { useTransitionNavigate } from "../../lib/transition"
import type { Product } from "../../lib/types"
import { HoverLabel } from "../ui/hover-label"

interface FocusWrapperProps {
  product: Product | null
  // The image a cart/upsell thumbnail flew in with. When set, the gallery opens
  // on that exact artwork instead of the index-0 cover, so the morphed image is
  // the one that stays put - no flash of image 1.
  initialImageSrc?: string | null
  onClose: () => void
  onDismiss: (opts?: { restoreOrigin?: boolean }) => void
  // Reopen a different artwork (from the "complete your set" thumbnails) by its
  // Shopify handle, morphing from the clicked thumbnail's box.
  onOpenArtwork?: (handle: string, fromRect: DOMRect, imageSrc?: string) => void
}

// Print size + framing options. Price is a fixed amount per size, plus a flat
// surcharge when framed. "Custom" has no price - it routes to the contact page.
type SizeKey = "8x8" | "12x12" | "16x16"

const SIZE_OPTIONS: { key: SizeKey; label: string }[] = [
  { key: "8x8", label: "8×8" },
  { key: "12x12", label: "12×12" },
  { key: "16x16", label: "16×16" },
]

// The soft drop shadow the site's artwork images carry (grid + collection cards).
const IMAGE_SHADOW = "shadow-[0_18px_28px_rgba(0,0,0,0.19)]"
// The individual product view lifts artworks 2/3/4 a little more strongly than the
// shared card shadow - ~30% more visible (0.19 -> 0.25 opacity).
const FOCUS_IMAGE_SHADOW = "shadow-[0_18px_28px_rgba(0,0,0,0.25)]"
const UPSELL_SLOT_COUNT = 4
const EMPTY_UPSELL_SLOT_KEYS = Array.from(
  { length: UPSELL_SLOT_COUNT },
  (_, i) => `empty-slot-${i + 1}`,
)

type AddedArtwork = {
  id: string
  lineId: string
  lineQuantity: number
  image: string
  alt: string
  handle: string
  dealKey: string | null
}

type UpsellSlot = AddedArtwork | null
type SelectedOption = { name: string; value: string }

function optionValue(options: SelectedOption[], name: string) {
  return options.find((option) => option.name.toLowerCase() === name)?.value
}

function normalizeDealPart(value: string | undefined) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/×/g, "x")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function dealMeta({
  sizeKey,
  sizeLabel,
  frameKey,
  frameLabel,
}: {
  sizeKey?: string
  sizeLabel?: string
  frameKey?: string
  frameLabel?: string
}) {
  const normalizedSize = normalizeDealPart(sizeKey ?? sizeLabel)
  const normalizedFrame = normalizeDealPart(frameKey ?? frameLabel)

  return {
    key: normalizedSize && normalizedFrame ? `${normalizedSize}:${normalizedFrame}` : null,
  }
}

export function FocusWrapper({
  product,
  initialImageSrc,
  onClose,
  onDismiss,
  onOpenArtwork,
}: FocusWrapperProps) {
  const isMobile = useIsMobile()
  const transitionNavigate = useTransitionNavigate()
  const {
    cart,
    addVariant,
    adding: cartAdding,
    checkoutUrl,
    configured: cartConfigured,
    error: cartError,
    removeLineUnit,
    removingLineIds,
  } = useShopifyCart()
  const collectionNameRef = useRef<HTMLHeadingElement>(null)
  const descriptionRef = useRef<HTMLParagraphElement>(null)
  const optionsRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const dividerContainerRef = useRef<HTMLDivElement>(null)
  const galleryOverlayRef = useRef<HTMLDivElement>(null)
  const galleryIndicatorRef = useRef<HTMLDivElement>(null)

  // Product details (description + purchase options) shown below the image.
  const detailsInnerRef = useRef<HTMLDivElement>(null)
  // The whole bottom info/options strip - measured so the image can be sized to
  // always clear it.
  const stripRef = useRef<HTMLDivElement>(null)

  // Gallery
  const imgRefs = useRef<(HTMLDivElement | null)[]>([])
  const currentIdxRef = useRef(0)
  const animatingRef = useRef(false)
  const accDeltaRef = useRef(0)
  const lockedRef = useRef(false)
  const lastWheelTimeRef = useRef(0)
  const galleryActiveRef = useRef(false)
  // Left/right drag (mouse or touch) to advance the gallery.
  const pointerActiveRef = useRef(false)
  const pointerStartXRef = useRef(0)
  const pointerStartYRef = useRef(0)
  const draggedRef = useRef(false)
  const [galleryActive, setGalleryActive] = useState(false)
  const [galleryIndicatorVisible, setGalleryIndicatorVisible] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)

  // Expanded (lightbox) view - current image morphs to a larger, centred
  // position over a white backdrop.
  const [expanded, setExpanded] = useState(false)
  const expandedActiveRef = useRef(false)
  const expandFromRectRef = useRef<DOMRect | null>(null)
  const expandImgRef = useRef<HTMLImageElement>(null)
  const expandOverlayRef = useRef<HTMLDivElement>(null)
  const closeExpandRef = useRef<HTMLButtonElement>(null)

  // Purchase configuration - both must be chosen before adding to cart.
  const [selectedSize, setSelectedSize] = useState<SizeKey | null>(null)
  const [withFrame, setWithFrame] = useState<boolean | null>(null)

  // "Complete your set" upsell panel, revealed after a piece is added to cart.
  const [upsellOpen, setUpsellOpen] = useState(false)
  const upsellRef = useRef<HTMLDivElement>(null)
  const [upsellDealKey, setUpsellDealKey] = useState<string | null>(null)
  // Add-to-cart button: once clicked it flips to an "Added" state. The button
  // label is animated between states - see the layout effect below.
  const [added, setAdded] = useState(false)
  const cartLabelRef = useRef<HTMLSpanElement>(null)
  const cartFirstRunRef = useRef(true)
  // True after the focus panel has opened, so repeated renders don't replay the
  // divider/close-button entrance.
  const prevOpenRef = useRef(false)
  const cartArtworkItems = useMemo<AddedArtwork[]>(
    () =>
      (cart?.lines.nodes ?? [])
        .flatMap((line) => {
          const merchandise = line.merchandise
          if (!merchandise) return []
          const sizeLabel = optionValue(merchandise.selectedOptions, "size")
          const frameLabel = optionValue(merchandise.selectedOptions, "frame")
          const deal = dealMeta({ sizeLabel, frameLabel })
          return Array.from({ length: line.quantity }, (_, i) => ({
            id: `${line.id}:${i}`,
            lineId: line.id,
            lineQuantity: line.quantity,
            image: merchandise.image?.url ?? "",
            alt: merchandise.image?.altText ?? merchandise.product.title,
            handle: merchandise.product.handle,
            dealKey: deal.key,
          }))
        })
        .filter((artwork) => artwork.image),
    [cart],
  )
  const [upsellSlots, setUpsellSlots] = useState<UpsellSlot[]>(
    EMPTY_UPSELL_SLOT_KEYS.map(() => null),
  )

  const isOpen = !!product

  const galleryImages: string[] =
    product?.images && product.images.length >= 2
      ? product.images
      : product
        ? Array.from({ length: 5 }, () => product.image)
        : []

  // Which gallery image the panel should open on. A cart/upsell thumbnail passes
  // the clicked artwork's image; match it so the gallery rests on that piece.
  // Falls back to the cover (0) for canvas/grid opens.
  const initialIdx = galleryIndexForImage(galleryImages, initialImageSrc)

  const selectedFrameKey = withFrame === null ? null : withFrame ? "framed" : "unframed"
  const currentGalleryImage = galleryImages[currentIdx]
  const selectedVariant = useMemo(() => {
    if (
      !product ||
      currentIdx === 0 ||
      !currentGalleryImage ||
      !selectedSize ||
      !selectedFrameKey
    ) {
      return null
    }
    const currentImageKey = mediaKey(currentGalleryImage)
    return (
      product.variants?.find(
        (variant) =>
          variant.sizeKey === selectedSize &&
          variant.frameKey === selectedFrameKey &&
          mediaKey(variant.image) === currentImageKey &&
          variant.availableForSale,
      ) ?? null
    )
  }, [currentGalleryImage, currentIdx, product, selectedFrameKey, selectedSize])

  const selectedDeal = useMemo(
    () =>
      selectedVariant
        ? dealMeta({
            sizeKey: selectedVariant.sizeKey,
            sizeLabel: selectedVariant.sizeLabel,
            frameKey: selectedVariant.frameKey,
            frameLabel: selectedVariant.frameLabel,
          })
        : null,
    [selectedVariant],
  )
  const activeUpsellDealKey =
    upsellDealKey ??
    selectedDeal?.key ??
    cartArtworkItems.find((item) => item.dealKey)?.dealKey ??
    null
  const upsellArtworkItems = useMemo(
    () =>
      activeUpsellDealKey
        ? cartArtworkItems.filter((item) => item.dealKey === activeUpsellDealKey)
        : cartArtworkItems,
    [activeUpsellDealKey, cartArtworkItems],
  )
  const upsellProgressCount = Math.min(upsellArtworkItems.length, UPSELL_SLOT_COUNT)

  useEffect(() => {
    setUpsellSlots((currentSlots) => {
      const remainingItems = [...upsellArtworkItems]
      const nextSlots = currentSlots.map((slot) => {
        if (!slot) return null

        const nextItemIndex = remainingItems.findIndex((item) => item.id === slot.id)
        if (nextItemIndex === -1) return null

        const [nextItem] = remainingItems.splice(nextItemIndex, 1)
        return nextItem
      })

      for (const item of remainingItems) {
        const openSlotIndex = nextSlots.findIndex((slot) => slot === null)
        if (openSlotIndex === -1) break
        nextSlots[openSlotIndex] = item
      }

      const unchanged = currentSlots.every((slot, i) => {
        const nextSlot = nextSlots[i]
        return (
          slot?.id === nextSlot?.id &&
          slot?.lineId === nextSlot?.lineId &&
          slot?.lineQuantity === nextSlot?.lineQuantity &&
          slot?.image === nextSlot?.image &&
          slot?.alt === nextSlot?.alt &&
          slot?.dealKey === nextSlot?.dealKey
        )
      })

      return unchanged ? currentSlots : nextSlots
    })
  }, [upsellArtworkItems])

  const price = selectedVariant?.price ?? null
  const canAddToCart = cartConfigured && !!selectedVariant && !cartAdding

  const cartLabel =
    added && selectedVariant
      ? `Add Another · $${price}`
      : cartAdding
        ? "Adding..."
        : !cartConfigured
          ? "Cart unavailable"
          : currentIdx === 0
            ? "Select Artwork"
            : selectedSize === null || withFrame === null
              ? "Add to Cart"
              : selectedVariant
                ? `Add to Cart · $${price}`
                : "Unavailable"

  // Cross-fade the add-to-cart label when it changes (e.g. Add to Cart -> Added).
  useLayoutEffect(() => {
    if (cartFirstRunRef.current) {
      cartFirstRunRef.current = false
      return
    }
    if (cartLabelRef.current) {
      gsap.fromTo(
        cartLabelRef.current,
        { opacity: 0, y: 5 },
        { opacity: 1, y: 0, duration: 0.3, ease: "power3.out" },
      )
    }
  }, [cartLabel])

  // "Custom" size can't be priced here - hand off to the contact page with the
  // custom-print inquiry preselected and the artwork name prefilled.
  const handleCustomSize = () => {
    if (!product) return
    transitionNavigate(`/contact?inquiry=custom&product=${encodeURIComponent(product.name)}`)
  }

  const handleAddToCart = async () => {
    if (!product || !selectedVariant || cartAdding) return
    const variantToAdd = selectedVariant
    setUpsellDealKey(
      dealMeta({
        sizeKey: variantToAdd.sizeKey,
        sizeLabel: variantToAdd.sizeLabel,
        frameKey: variantToAdd.frameKey,
        frameLabel: variantToAdd.frameLabel,
      }).key,
    )
    await addVariant(variantToAdd.shopifyVariantId, 1)
    track("add_to_cart", { label: product.name })
    setAdded(true)
    setUpsellOpen(true)
  }

  useEffect(() => {
    setAdded(false)
  }, [selectedVariant?.shopifyVariantId])

  // ── Reset + activate gallery on product open/close ────────────────────────
  // Layout effect (not passive) so the gallery is blanked and re-pointed before
  // the browser paints: a thumbnail open flushSync-renders the new product with
  // the old gallery still visible, and this runs in the same commit to hide it,
  // so image 1 never flashes before the clicked image morphs in.
  useLayoutEffect(() => {
    // Keep the upsell panel closed on a fresh product open; cart contents come
    // from Shopify and are not reset here.
    const isSwitch = prevOpenRef.current
    if (!isSwitch) {
      setUpsellOpen(false)
      setUpsellDealKey(null)
    }
    setAdded(false)
    if (!isOpen) {
      prevOpenRef.current = false
      setUpsellOpen(false)
      setUpsellDealKey(null)
      galleryActiveRef.current = false
      setGalleryActive(false)
      setGalleryIndicatorVisible(false)
      setCurrentIdx(0)
      currentIdxRef.current = 0
      animatingRef.current = false
      accDeltaRef.current = 0
      lockedRef.current = false
      lastWheelTimeRef.current = 0
      setSelectedSize(null)
      setWithFrame(null)
      expandedActiveRef.current = false
      setExpanded(false)
      return
    }

    // Blank the gallery overlay while the clicked image morphs in (the timer below
    // fades it back once the piece has landed). On a switch it would otherwise stay
    // lit on the previous artwork's image.
    galleryActiveRef.current = false
    setGalleryActive(false)
    // Open on the image the thumbnail flew in with (its gallery index), so the
    // morphed piece is the one that stays put. Canvas/grid opens use the cover (0).
    currentIdxRef.current = initialIdx
    setGalleryIndicatorVisible(false)
    setCurrentIdx(initialIdx)
    animatingRef.current = false
    accDeltaRef.current = 0
    lockedRef.current = false
    lastWheelTimeRef.current = 0
    setSelectedSize(null)
    setWithFrame(null)

    imgRefs.current.forEach((el, i) => {
      if (el) gsap.set(el, { x: 0, display: i === initialIdx ? "block" : "none" })
    })

    const timer = setTimeout(() => {
      galleryActiveRef.current = true
      setGalleryActive(true)
      setGalleryIndicatorVisible(true)
    }, 1250)
    return () => clearTimeout(timer)
  }, [isOpen, product?.id, initialIdx])

  // ── Slide to next / previous image from the section divider ─────────────
  const navigate = useCallback((dir: 1 | -1) => {
    const total = imgRefs.current.filter(Boolean).length
    const cur = currentIdxRef.current
    const next = cur + dir
    if (next < 0 || next >= total || animatingRef.current) return

    animatingRef.current = true
    lockedRef.current = true

    const curEl = imgRefs.current[cur]
    const nextEl = imgRefs.current[next]
    if (!curEl || !nextEl) {
      animatingRef.current = false
      lockedRef.current = false
      return
    }

    // Slide the images as a tight, edge-to-edge filmstrip: the incoming image's
    // leading edge sits flush against the outgoing image's trailing edge, so the
    // new image swipes in from the right with no background ever showing through
    // the gap. That means the slide distance is exactly one frame width (the
    // overlay clips the overflow to the frame).
    const frameEl = document.getElementById("focus-image-frame")
    const dist = frameEl ? frameEl.offsetWidth : (panelRef.current?.offsetWidth ?? 900)

    // Advance the active dot at the start of the slide so the indicator
    // tracks the image in sync, rather than jumping after the tween ends.
    currentIdxRef.current = next
    setCurrentIdx(next)

    gsap.set(nextEl, { x: dir * dist, display: "block" })
    gsap.to(curEl, { x: -dir * dist, duration: 0.7, ease: "power3.inOut" })
    gsap.to(nextEl, {
      x: 0,
      duration: 0.7,
      ease: "power3.inOut",
      onComplete: () => {
        gsap.set(curEl, { display: "none", x: 0 })
        animatingRef.current = false
        // Brief cooldown after the slide so trailing momentum-scroll can't
        // immediately trigger a second navigation when scrolling hard.
        window.setTimeout(() => {
          lockedRef.current = false
        }, 150)
      },
    })
  }, [])

  // ── Wheel listener ────────────────────────────────────────────────────────
  const onWheel = useCallback(
    (e: WheelEvent) => {
      if (!galleryActiveRef.current) return
      e.preventDefault()

      // While the lightbox is open, swallow wheel input so the gallery beneath
      // it can't slide.
      if (expandedActiveRef.current) {
        accDeltaRef.current = 0
        return
      }

      // While a slide is running (or during its cooldown) swallow wheel input
      // so momentum-scroll can't queue up and skip past images.
      if (animatingRef.current || lockedRef.current) {
        accDeltaRef.current = 0
        return
      }

      // Reset the accumulator after an idle pause so each transition requires a
      // fresh, deliberate scroll gesture rather than leftover momentum.
      const now = performance.now()
      if (now - lastWheelTimeRef.current > 180) accDeltaRef.current = 0
      lastWheelTimeRef.current = now

      // Accept either axis: vertical scroll or a horizontal/trackpad swipe. Use
      // whichever delta dominates this event (down or right = next).
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      accDeltaRef.current += delta
      if (Math.abs(accDeltaRef.current) >= 60) {
        navigate(accDeltaRef.current > 0 ? 1 : -1)
        accDeltaRef.current = 0
      }
    },
    [navigate],
  )

  useEffect(() => {
    if (isMobile) return
    const panel = panelRef.current
    if (!panel) return
    panel.addEventListener("wheel", onWheel, { passive: false })
    return () => panel.removeEventListener("wheel", onWheel)
  }, [isMobile, onWheel])

  // ── Drag to navigate (mouse / touch) ──────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!galleryActiveRef.current || expandedActiveRef.current) return
    pointerActiveRef.current = true
    pointerStartXRef.current = e.clientX
    pointerStartYRef.current = e.clientY
    draggedRef.current = false
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerActiveRef.current) return
    // Past a small threshold this is a drag, not a click - used to suppress the
    // click-to-expand that would otherwise fire on release.
    if (Math.abs(e.clientX - pointerStartXRef.current) > 8) draggedRef.current = true
  }, [])

  const onPointerEnd = useCallback(
    (e: React.PointerEvent) => {
      if (!pointerActiveRef.current) return
      pointerActiveRef.current = false
      const dx = e.clientX - pointerStartXRef.current
      const dy = e.clientY - pointerStartYRef.current
      // Swipe left (content moves left) -> next; swipe right -> previous.
      if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy)) navigate(dx < 0 ? 1 : -1)
    },
    [navigate],
  )

  // ── Panel entrance animation ──────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    // Only a fresh panel open wipes in the divider and close button.
    const isSwitch = prevOpenRef.current
    prevOpenRef.current = true

    gsap.set(panelRef.current, { clipPath: "none" })

    if (!isSwitch) {
      // Fade the left backdrop (canvas colour) in over the slide so the canvas
      // is visibly sliding away beneath it, then it settles opaque - masking any
      // sliver the zoomed canvas would otherwise leave just left of the divider.
      gsap.fromTo(
        panelRef.current,
        { backgroundColor: "rgba(240,237,230,0)" },
        { backgroundColor: "rgba(240,237,230,1)", duration: 1.1, ease: "expo.inOut" },
      )

      // The divider + its × only exist on desktop.
      if (dividerContainerRef.current) {
        gsap.set(dividerContainerRef.current, { x: "-60vw" })
        gsap.to(dividerContainerRef.current, { x: 0, duration: 1.1, ease: "expo.inOut" })
      }

      if (closeRef.current) {
        gsap.set(closeRef.current, { opacity: 0, scale: 0 })
        gsap.to(closeRef.current, {
          opacity: 1,
          scale: 1,
          duration: 0.35,
          delay: 1.05,
          ease: "back.out(1.7)",
        })
      }
    } else {
      // The backdrop is already in place on repeated renders.
      gsap.set(panelRef.current, { backgroundColor: "rgba(240,237,230,1)" })
    }

    const textEls = [collectionNameRef.current, detailsInnerRef.current].filter(
      Boolean,
    ) as HTMLElement[]

    gsap.set(textEls, { opacity: 0, y: 14 })

    const tl = gsap.timeline({ delay: 0.6 })
    tl.to(collectionNameRef.current, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, 0)
    tl.to(detailsInnerRef.current, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, 0.3)

    return () => {
      tl.kill()
    }
  }, [isOpen, product?.id])

  // ── Upsell panel reveal ───────────────────────────────────────────────────
  // Desktop keeps the overlay slide. Mobile reveals the panel in document flow
  // and scrolls the focused panel to it.
  useEffect(() => {
    const panel = upsellRef.current
    const close = closeRef.current
    if (!panel) return
    gsap.killTweensOf(panel)

    if (isMobile) {
      if (upsellOpen) {
        gsap.set(panel, { display: "block" })
        gsap.fromTo(
          panel,
          { autoAlpha: 0, y: 18 },
          { autoAlpha: 1, y: 0, duration: 0.45, ease: "power3.out" },
        )
        window.requestAnimationFrame(() => {
          panel.scrollIntoView({ behavior: "smooth", block: "start" })
        })
      } else {
        gsap.to(panel, {
          autoAlpha: 0,
          y: 12,
          duration: 0.25,
          ease: "power2.in",
          onComplete: () => gsap.set(panel, { display: "none", clearProps: "transform" }),
        })
      }
      return
    }

    const liftY = -window.innerHeight * 0.14 // 50vh centre → 36vh panel top
    if (upsellOpen) {
      gsap.set(panel, { display: "block" })
      gsap.fromTo(panel, { yPercent: 100 }, { yPercent: 0, duration: 0.9, ease: "expo.inOut" })
      if (close) gsap.to(close, { y: liftY, duration: 0.9, ease: "expo.inOut" })
    } else {
      gsap.to(panel, {
        yPercent: 100,
        duration: 0.7,
        ease: "expo.inOut",
        onComplete: () => gsap.set(panel, { display: "none" }),
      })
      if (close) gsap.to(close, { y: 0, duration: 0.7, ease: "expo.inOut" })
    }
  }, [isMobile, upsellOpen])

  // ── Close ─────────────────────────────────────────────────────────────────
  const handleClose = () => {
    galleryActiveRef.current = false
    animatingRef.current = false
    setGalleryIndicatorVisible(false)
    // Slide the upsell panel back down as part of the close.
    setUpsellOpen(false)

    // Fade text + CTA out immediately so they don't linger during the wipe
    const textEls = [collectionNameRef.current, detailsInnerRef.current, closeRef.current].filter(
      Boolean,
    ) as HTMLElement[]
    gsap.to(textEls, { opacity: 0, y: -6, duration: 0.25, stagger: 0.03, ease: "power2.in" })
    gsap.to(galleryIndicatorRef.current, { opacity: 0, duration: 0.2, ease: "power2.in" })

    const triggerClose = () => {
      // Hide the gallery overlay instantly so the morphing canvas beneath is clean
      gsap.set(galleryOverlayRef.current, { opacity: 0 })
      gsap.set(panelRef.current, { clipPath: "inset(0 0% 0 0)" })
      gsap.to(panelRef.current, {
        clipPath: "inset(0 100% 0 0)",
        duration: 1.1,
        ease: "expo.inOut",
      })
      if (dividerContainerRef.current) {
        gsap.to(dividerContainerRef.current, { x: "-60vw", duration: 1.0, ease: "expo.inOut" })
      }
      onClose()
    }

    const idx = currentIdxRef.current
    if (idx === 0) {
      triggerClose()
      return
    }

    // Kill any in-progress slide tweens
    imgRefs.current.forEach((el) => {
      if (el) gsap.killTweensOf(el)
    })

    const frameEl = document.getElementById("focus-image-frame")
    const dist = frameEl ? frameEl.offsetWidth : (panelRef.current?.offsetWidth ?? 900)

    // Lay all images 0..idx out as a filmstrip (same spacing as normal navigation)
    // then animate the whole strip right so image 0 lands at x=0
    for (let i = 0; i <= idx; i++) {
      const el = imgRefs.current[i]
      if (el) gsap.set(el, { x: (i - idx) * dist, display: "block" })
    }

    const strip = imgRefs.current.slice(0, idx + 1).filter((el): el is HTMLDivElement => !!el)

    gsap.to(strip, {
      x: `+=${idx * dist}`,
      duration: 0.55,
      ease: "power3.inOut",
      onComplete: () => {
        imgRefs.current.forEach((el, i) => {
          if (el && i !== 0) gsap.set(el, { display: "none", x: 0 })
        })
        currentIdxRef.current = 0
        setCurrentIdx(0)
        triggerClose()
      },
    })
  }

  // ── Explore collection ────────────────────────────────────────────────────
  // Leave the focus panel for the artwork's collection page.
  const handleExploreCollection = () => {
    if (!product) return
    emitPopupAction("collection")
    const target = `/collection/${product.collectionSlug}`

    galleryActiveRef.current = false
    animatingRef.current = false
    setGalleryIndicatorVisible(false)
    setUpsellOpen(false)

    if (target === window.location.pathname) {
      onDismiss()
    } else {
      transitionNavigate(target, {
        type: "white",
        state: { skipCollectionIntro: true },
        onNavigate: () => onDismiss({ restoreOrigin: false }),
      })
    }
  }

  // ── Expanded (lightbox) view ──────────────────────────────────────────────
  const openExpanded = () => {
    // A drag that ends on the image shouldn't also open the lightbox.
    if (draggedRef.current) {
      draggedRef.current = false
      return
    }
    if (!galleryActiveRef.current || expandedActiveRef.current) return
    const el = imgRefs.current[currentIdxRef.current]
    if (!el) return
    expandFromRectRef.current = el.getBoundingClientRect()
    expandedActiveRef.current = true
    setExpanded(true)
  }

  const closeExpanded = useCallback(() => {
    const img = expandImgRef.current
    const overlay = expandOverlayRef.current
    // Morph back to wherever the source image now sits in the panel.
    const liveEl = imgRefs.current[currentIdxRef.current]
    const from = liveEl?.getBoundingClientRect() ?? expandFromRectRef.current

    if (!img || !overlay || !from) {
      expandedActiveRef.current = false
      setExpanded(false)
      return
    }

    gsap.killTweensOf(img)
    gsap.to(closeExpandRef.current, { opacity: 0, scale: 0, duration: 0.2, ease: "power2.in" })
    gsap.to(img, {
      left: from.left,
      top: from.top,
      width: from.width,
      height: from.height,
      duration: 0.6,
      ease: "expo.inOut",
    })
    gsap.to(overlay, {
      opacity: 0,
      duration: 0.45,
      delay: 0.15,
      ease: "power2.in",
      onComplete: () => {
        expandedActiveRef.current = false
        setExpanded(false)
      },
    })
  }, [])

  // Morph the image out to a larger, centred position when the lightbox opens.
  useEffect(() => {
    if (!expanded) return
    const from = expandFromRectRef.current
    const img = expandImgRef.current
    const overlay = expandOverlayRef.current
    if (!from || !img || !overlay) return

    const aspect = from.width / from.height
    let w = window.innerWidth * 0.7
    let h = w / aspect
    const maxH = window.innerHeight * 0.82
    if (h > maxH) {
      h = maxH
      w = h * aspect
    }
    const left = (window.innerWidth - w) / 2
    const top = (window.innerHeight - h) / 2

    gsap.set(overlay, { opacity: 0 })
    gsap.to(overlay, { opacity: 1, duration: 0.4, ease: "power2.out" })

    gsap.set(img, {
      position: "fixed",
      margin: 0,
      left: from.left,
      top: from.top,
      width: from.width,
      height: from.height,
    })
    gsap.to(img, { left, top, width: w, height: h, duration: 0.75, ease: "expo.inOut" })

    gsap.set(closeExpandRef.current, { opacity: 0, scale: 0 })
    gsap.to(closeExpandRef.current, {
      opacity: 1,
      scale: 1,
      duration: 0.35,
      delay: 0.5,
      ease: "back.out(1.7)",
    })
  }, [expanded])

  // Escape closes the lightbox.
  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeExpanded()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [expanded, closeExpanded])

  // ── Keep the image sized to the active layout ─────────────────────────────
  // Desktop still reserves room for the pinned bottom strip. Mobile keeps the
  // frame in document flow and only resizes the artwork box itself.
  const fitImageFrame = useCallback(() => {
    const frame = document.getElementById("focus-image-frame")
    const strip = stripRef.current
    if (!frame || !strip) return

    const aspect = frame.offsetWidth / frame.offsetHeight
    const isMd = window.innerWidth >= 768
    if (!isMd) {
      const maxW = window.innerWidth * 0.86
      const maxH = Math.max(window.innerHeight * 0.62, 240)
      let tw = maxW
      let th = tw / aspect
      if (th > maxH) {
        th = maxH
        tw = th * aspect
      }
      frame.style.top = ""
      frame.style.bottom = ""
      gsap.to(frame, {
        width: tw,
        height: th,
        duration: 0.4,
        ease: "expo.inOut",
      })
      return
    }

    const titleTop = 40
    const titleFont = Math.min(Math.max(window.innerWidth * 0.06, 36), 72)
    // Tighter gap between the title and the artwork (~50% less) so the piece sits
    // higher and reads larger.
    const topReserve = titleTop + titleFont + 5

    // The strip is anchored at bottom-8 (32px); keep a gap above it.
    const STRIP_OFFSET = 32
    const GAP = 22
    // The gallery dots + "Swipe to select artwork" hint sit just below the
    // artwork (top-full, mt-[18px]). Reserve their footprint too so the piece
    // shifts up and the hint clears the description/options strip beneath it
    // rather than overlapping it.
    const indicator = galleryIndicatorRef.current
    const INDICATOR_GAP = 18
    const indicatorReserve = indicator ? INDICATOR_GAP + indicator.offsetHeight : 0
    const bottomReserve = strip.offsetHeight + STRIP_OFFSET + GAP + indicatorReserve

    // Artwork size cap, raised ~25% so the piece is a bit larger. Height is still
    // bounded by maxH below, so it never crowds the title or the options strip.
    const maxW = Math.min(window.innerWidth * 0.45, 550)
    const panelHeight = panelRef.current?.offsetHeight ?? window.innerHeight
    const maxH = Math.max(panelHeight - topReserve - bottomReserve, 160)
    let tw = maxW
    let th = tw / aspect
    if (th > maxH) {
      th = maxH
      tw = th * aspect
    }
    gsap.to(frame, {
      width: tw,
      height: th,
      top: topReserve,
      bottom: bottomReserve,
      duration: 0.4,
      ease: "expo.inOut",
    })
  }, [])

  useEffect(() => {
    if (!isOpen) return
    // Run after the open-morph has settled the image into the slot, so resizing
    // the frame carries the image with it rather than fighting the morph.
    const t = window.setTimeout(fitImageFrame, 1200)
    window.addEventListener("resize", fitImageFrame)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener("resize", fitImageFrame)
    }
  }, [isOpen, product?.id, fitImageFrame])

  const expandedSrc = galleryImages[currentIdx] ?? product?.image ?? ""
  const expandFrom = expandFromRectRef.current
  const galleryIndicator = (
    <div
      ref={galleryIndicatorRef}
      className={clsx(
        "z-[4] flex flex-col items-center gap-2",
        // ~15% more breathing room between the artwork and the dots/swipe hint.
        isMobile ? "relative mt-[18px]" : "absolute top-full left-1/2 mt-[18px] -translate-x-1/2",
      )}
      style={{
        opacity: galleryActive && galleryIndicatorVisible ? 1 : 0,
        transition: "opacity 0.4s ease",
      }}
    >
      <div className="flex items-center gap-1.5">
        {galleryImages.map((_, i) => (
          <div
            key={i}
            className={clsx(
              "rounded-full bg-dark transition-all duration-700 ease-out",
              i === currentIdx ? "h-1.5 w-5" : "h-1.5 w-1.5 opacity-20",
            )}
          />
        ))}
      </div>
      {galleryImages.length > 1 && (
        <p className="text-[11px] tracking-wide text-dark/45">Swipe to select artwork</p>
      )}
    </div>
  )
  const upsellPanelContent = (
    <div
      className={clsx(
        "flex flex-col items-center justify-center gap-6 px-6 py-6 md:px-9",
        !isMobile && "h-full",
      )}
    >
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-xs font-medium tracking-[0.2em] text-dark/45 uppercase">
          {upsellProgressCount}/{UPSELL_SLOT_COUNT}
        </p>
        <p className="text-base font-medium text-dark">Buy 3 get 1 free</p>
        <p className="text-xs text-dark/50">Framing and size must be the same</p>
      </div>

      <div className="mx-auto w-full max-w-[18rem]">
        <div className="grid grid-cols-2 gap-3">
          {EMPTY_UPSELL_SLOT_KEYS.map((slotKey, slotIndex) => {
            const artwork = upsellSlots[slotIndex]

            return artwork ? (
              <div key={slotKey} className="relative aspect-square">
                <button
                  type="button"
                  onClick={(e) => {
                    if (!artwork.handle) return
                    onOpenArtwork?.(
                      artwork.handle,
                      e.currentTarget.getBoundingClientRect(),
                      artwork.image,
                    )
                  }}
                  aria-label={`Open ${artwork.alt}`}
                  className={clsx("block h-full w-full overflow-hidden", IMAGE_SHADOW)}
                >
                  <img
                    src={artwork.image}
                    alt={artwork.alt}
                    className="h-full w-full object-cover"
                  />
                </button>
                <button
                  type="button"
                  onClick={() => void removeLineUnit(artwork.lineId, artwork.lineQuantity)}
                  disabled={removingLineIds.includes(artwork.lineId)}
                  aria-label="Remove from cart"
                  className={clsx(
                    "group absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-dark/10 bg-canvas/85 text-dark/55 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-dark/25 hover:bg-dark hover:text-white disabled:pointer-events-none disabled:opacity-40",
                    removingLineIds.includes(artwork.lineId) && "opacity-40",
                  )}
                >
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    className="h-3 w-3 transition-transform duration-300 group-hover:rotate-90"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 4l8 8M12 4l-8 8"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            ) : (
              <div
                key={slotKey}
                className="flex aspect-square items-center justify-center rounded-sm border border-dashed border-dark/20 bg-dark/[0.025]"
                aria-label="Empty set slot"
              >
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-dark/15 text-lg leading-none text-dark/25"
                >
                  +
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <a
        href={checkoutUrl ?? undefined}
        target={checkoutUrl ? "_blank" : undefined}
        rel="noopener noreferrer"
        aria-disabled={!checkoutUrl}
        className={clsx(
          "group flex w-full max-w-[18rem] items-center justify-center rounded-lg px-5 py-3.5 text-sm font-medium text-white transition-opacity duration-300",
          checkoutUrl ? "bg-dark hover:opacity-80" : "pointer-events-none bg-dark/25",
        )}
      >
        <HoverLabel>Proceed to checkout</HoverLabel>
      </a>
    </div>
  )

  return (
    <div className={clsx("focus-wrapper", isOpen && "active")}>
      {/* Left panel - 60vw. Transparent by default so the home canvas slide-away
          morph shows through; opaque only when opening over static page content. */}
      <div
        ref={panelRef}
        data-focus-panel
        className={clsx(
          "absolute inset-y-0 left-0",
          isMobile ? "overflow-x-hidden overflow-y-auto overscroll-contain" : "overflow-hidden",
        )}
        style={{
          width: isMobile ? "100vw" : "60vw",
          visibility: isOpen ? "visible" : "hidden",
          touchAction: isMobile ? "pan-y" : undefined,
        }}
      >
        {/* Product name */}
        <h2
          ref={collectionNameRef}
          className={clsx(
            "pointer-events-none relative z-20 leading-none font-medium text-dark",
            isMobile ? "mx-6 pt-8 pr-14" : "mt-8 ml-8 md:mt-10 md:ml-10",
          )}
          style={{ fontSize: "clamp(2.25rem, 6vw, 4.5rem)", letterSpacing: "-0.04em", opacity: 0 }}
        >
          {product?.name}
        </h2>

        {/* Image area */}
        <div
          id="focus-image-frame"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onPointerLeave={onPointerEnd}
          className={clsx(
            isMobile ? "relative z-10 mx-auto mt-8" : "absolute",
            "transition-shadow duration-700 ease-out",
            currentIdx !== 0 && FOCUS_IMAGE_SHADOW,
          )}
          style={isMobile ? { touchAction: "pan-y" } : { inset: 0, margin: "auto" }}
        >
          <div id="focus-image-slot" className="pointer-events-none absolute inset-0 z-[1]" />

          {/* Gallery overlay - fades in after morph, canvas bg fills the gap between sliding images */}
          {isOpen && (
            <div
              ref={galleryOverlayRef}
              className="absolute inset-0 z-[2]"
              style={{
                backgroundColor: "#f0ede6",
                opacity: galleryActive ? 1 : 0,
                transition: "opacity 0.35s ease",
                pointerEvents: "none",
                // Clip the sliding images to the frame so a swipe stays within the
                // image rectangle - no image spills over the panel background.
                overflow: "hidden",
              }}
            >
              {galleryImages.map((src, i) => (
                <div
                  key={`${product?.id}-${i}`}
                  ref={(el) => {
                    imgRefs.current[i] = el
                  }}
                  className="absolute inset-0"
                  style={{ display: i === 0 ? "block" : "none" }}
                >
                  <img
                    src={src}
                    alt={product?.name ?? ""}
                    draggable={false}
                    className="pointer-events-none h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Hover affordance - click the image to open the expanded view */}
          {galleryActive && (
            <button
              type="button"
              onClick={openExpanded}
              aria-label="Expand image"
              className="group absolute inset-0 z-[3] flex items-center justify-center"
            >
              <span className="flex h-14 w-14 scale-90 items-center justify-center rounded-full bg-dark/65 text-light opacity-0 backdrop-blur-sm transition-all duration-300 ease-out group-hover:scale-100 group-hover:opacity-100">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4" />
                </svg>
              </span>
            </button>
          )}

          {!isMobile && galleryIndicator}
        </div>
        {isMobile && galleryIndicator}

        {/* Details strip */}
        <div
          ref={stripRef}
          className={clsx(
            "z-20",
            isMobile ? "relative mx-6 mt-8 pb-12" : "absolute inset-x-6 bottom-8 md:inset-x-10",
          )}
        >
          {/* Details - description, options, explore collection. Mobile stays in
              document flow so longer copy can scroll naturally. */}
          <div
            ref={detailsInnerRef}
            className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6"
          >
            {/* Left: description + explore collection */}
            <div className="min-w-0">
              <p
                ref={descriptionRef}
                className="text-xs leading-relaxed text-dark/55"
                style={{ maxWidth: "55ch" }}
              >
                {product?.description}
              </p>
              <button
                type="button"
                onClick={handleExploreCollection}
                className="group mt-4 inline-flex items-center gap-1.5 rounded-lg border border-dark/20 px-3.5 py-2 text-[11px] font-medium text-dark transition-colors hover:border-dark/40"
              >
                <HoverLabel>Explore collection</HoverLabel>
                <span className="transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </button>
            </div>

            {/* Right: purchase controls */}
            <div ref={optionsRef} className="grid w-full flex-shrink-0 gap-1.5 md:w-[22rem]">
              <div className="grid grid-cols-4 gap-1.5">
                {SIZE_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setSelectedSize(key)}
                    aria-pressed={selectedSize === key}
                    className={clsx(
                      "group flex min-w-0 items-center justify-center rounded-lg border px-2 py-2 text-[11px] font-medium transition-colors",
                      selectedSize === key
                        ? "border-dark bg-dark text-white"
                        : "border-dark/20 text-dark hover:border-dark/40",
                    )}
                  >
                    <HoverLabel>{label}</HoverLabel>
                  </button>
                ))}
                <button
                  onClick={handleCustomSize}
                  className="group flex min-w-0 items-center justify-center rounded-lg border border-dark/20 px-2 py-2 text-[11px] font-medium text-dark transition-colors hover:border-dark/40"
                >
                  <HoverLabel>Custom</HoverLabel>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { value: true, label: "Framed" },
                    { value: false, label: "Unframed" },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={label}
                    onClick={() => setWithFrame(value)}
                    aria-pressed={withFrame === value}
                    className={clsx(
                      "group flex min-w-0 items-center justify-center rounded-lg border px-2 py-2 text-[11px] font-medium transition-colors",
                      withFrame === value
                        ? "border-dark bg-dark text-white"
                        : "border-dark/20 text-dark hover:border-dark/40",
                    )}
                  >
                    <HoverLabel>{label}</HoverLabel>
                  </button>
                ))}
              </div>
              <button
                aria-label={added ? "Add another to cart" : "Add to cart"}
                disabled={!canAddToCart}
                onClick={async (e) => {
                  e.preventDefault()
                  if (canAddToCart) await handleAddToCart()
                }}
                className={clsx(
                  "group flex min-w-0 items-center justify-center overflow-hidden rounded-lg border px-2 py-2 text-[11px] font-medium tracking-wide whitespace-nowrap transition-colors",
                  canAddToCart
                    ? "border-dark bg-dark text-white hover:opacity-70"
                    : "border-dark/20 bg-dark/20 text-dark/40",
                )}
              >
                <span ref={cartLabelRef} className="inline-block">
                  <HoverLabel>{cartLabel}</HoverLabel>
                </span>
              </button>
              {cartError && (
                <p className="max-w-[17rem] text-[10px] leading-4 text-red-700">{cartError}</p>
              )}
            </div>
          </div>
        </div>

        {isOpen && isMobile && (
          <div
            ref={upsellRef}
            className="mx-6 mb-12 border-t border-dark/20 bg-canvas"
            style={{ display: "none" }}
          >
            {upsellPanelContent}
          </div>
        )}
      </div>

      {/* Click the exposed canvas to the right of the panel to close (same as ×).
          Desktop only - on mobile the panel is full-screen, so there's no exposed
          canvas and the corner × handles closing. */}
      {isOpen && !isMobile && (
        <button
          type="button"
          onClick={handleClose}
          aria-label="Back to canvas"
          className="absolute inset-y-0 right-0"
          style={{ left: "60vw" }}
        />
      )}

      {/* Mobile close - a corner × since the divider/exposed-canvas close isn't
          reachable when the panel fills the screen. */}
      {isOpen && isMobile && (
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="absolute top-6 right-5 z-30 flex h-10 w-10 items-center justify-center rounded-lg border border-dark/20 bg-[#f0ede6] text-dark transition-colors hover:bg-dark hover:text-white"
        >
          <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
            <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" />
            <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      )}

      {/* Desktop upsell panel - rises from the bottom-right after add-to-cart. */}
      {isOpen && !isMobile && (
        <div
          ref={upsellRef}
          className="absolute right-0 border-t border-dark/20 bg-canvas"
          style={{ left: "60vw", top: "36vh", bottom: 0, display: "none" }}
        >
          {upsellPanelContent}
        </div>
      )}

      {/* Divider line + × button - desktop only (the divider sits on the panel /
          canvas seam, which doesn't exist when the panel is full-screen). */}
      {isOpen && !isMobile && (
        <div
          ref={dividerContainerRef}
          className="absolute inset-y-0"
          style={{ left: "60vw", transform: "translateX(-60vw)" }}
        >
          <div
            className="absolute inset-y-0 flex flex-col items-center justify-center"
            style={{ transform: "translateX(-50%)" }}
          >
            <div className="h-full w-px bg-dark/15" />
            <button
              ref={closeRef}
              onClick={handleClose}
              className="absolute flex h-10 w-10 items-center justify-center rounded-none border border-dark/20 bg-[#f0ede6] text-dark transition-all duration-300 hover:rounded-lg hover:bg-dark hover:text-white"
              style={{ opacity: 0, transform: "scale(0)" }}
              aria-label="Close"
            >
              <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
                <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" />
                <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Expanded (lightbox) view */}
      {expanded && (
        <div
          ref={expandOverlayRef}
          className="fixed inset-0 z-[2000] bg-white"
          style={{ opacity: 0 }}
        >
          {/* Backdrop - click anywhere outside to close */}
          <button
            type="button"
            onClick={closeExpanded}
            aria-label="Close expanded image"
            className="absolute inset-0 z-[1]"
          />
          <button
            ref={closeExpandRef}
            type="button"
            onClick={closeExpanded}
            aria-label="Close expanded image"
            className="site-top-close absolute right-6 z-[3] flex h-11 w-11 items-center justify-center rounded-none border border-dark/20 bg-white text-dark transition-all duration-300 hover:rounded-lg hover:bg-dark hover:text-white md:right-8"
            style={{ opacity: 0 }}
          >
            <svg viewBox="0 0 12 12" fill="none" className="h-3.5 w-3.5">
              <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" />
              <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <img
            ref={expandImgRef}
            src={expandedSrc}
            alt={product?.name ?? ""}
            draggable={false}
            className="pointer-events-none object-cover"
            style={
              expandFrom
                ? {
                    position: "fixed",
                    margin: 0,
                    left: expandFrom.left,
                    top: expandFrom.top,
                    width: expandFrom.width,
                    height: expandFrom.height,
                  }
                : { opacity: 0 }
            }
          />
        </div>
      )}
    </div>
  )
}
