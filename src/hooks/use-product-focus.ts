import { useCallback, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { track } from "../lib/analytics"
import { gsap } from "../lib/gsap"
import { emitPopupAction } from "../lib/marketing"
import type { Product } from "../lib/types"

// How far the underlying view (canvas/grid) slides aside so the focus panel can
// take its place. On mobile the panel is full-screen, so the page slides the whole
// way off (100vw) - no sliver of the previous view stays visible.
const MOBILE_QUERY = "(max-width: 767px)"
function shiftFraction() {
  if (typeof window === "undefined") return 0.6
  return window.matchMedia(MOBILE_QUERY).matches ? 1 : 0.6
}

// Reflect the focused artwork in the URL as a `?artwork=<slug>` query param
// (and clear it on close) without touching react-router: we keep the current
// route matched and its history state intact, so nothing re-renders and the
// open morph is undisturbed. The param is purely cosmetic - a reload still
// resolves the real path, which simply ignores it.
function setArtworkParam(slug: string | null) {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  if (slug) url.searchParams.set("artwork", slug)
  else url.searchParams.delete("artwork")
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`)
}

function getReturnStyle(el: HTMLElement) {
  const copy = document.createElement("div")
  copy.setAttribute("style", el.getAttribute("style") ?? "")
  ;["transform", "translate", "rotate", "scale", "filter", "opacity", "z-index", "margin"].forEach(
    (prop) => copy.style.removeProperty(prop),
  )
  return copy.getAttribute("style") ?? ""
}

// Shared "open a product into the focus panel" morph. The clicked element flies
// from its on-screen spot into #focus-image-slot (rendered by <FocusWrapper />),
// leaving a placeholder behind so the source layout doesn't reflow; closing
// reverses it. Optionally slides a background element aside during the morph.
export function useProductFocus() {
  const [focusedProduct, setFocusedProduct] = useState<Product | null>(null)
  const focusedElRef = useRef<HTMLElement | null>(null)
  const placeholderRef = useRef<HTMLElement | null>(null)
  const originalStyleRef = useRef("")
  const isFocusedRef = useRef(false)
  const shiftElRef = useRef<HTMLElement | null>(null)

  const beginFocus = useCallback(
    (
      product: Product,
      el: HTMLElement | null,
      shiftEl?: HTMLElement | null,
      // Thumbnail opens (cart / upsell) fly a lightweight clone instead of the
      // real element: `cloneSrc` is the image to fly, `fromRect` its start box.
      // The source thumbnail - which React still owns - is never detached, and
      // there's no placeholder to restore, so closing just drops the clone.
      opts?: { cloneSrc?: string; fromRect?: DOMRect },
    ) => {
      if (isFocusedRef.current) return
      emitPopupAction("product")
      track("product_view", { label: product.name })
      if (product.slug) setArtworkParam(product.slug)
      isFocusedRef.current = true
      shiftElRef.current = shiftEl ?? null

      const slot = document.getElementById("focus-image-slot")
      if (!slot) {
        isFocusedRef.current = false
        return
      }
      const panel = slot.closest("[data-focus-panel]") as HTMLElement | null
      if (panel) panel.scrollTop = 0

      const fromRect = opts?.fromRect ?? el?.getBoundingClientRect()
      if (!fromRect) {
        isFocusedRef.current = false
        return
      }

      // The element that actually flies into the slot.
      let moving: HTMLElement
      if (opts?.cloneSrc) {
        const clone = document.createElement("img")
        clone.src = opts.cloneSrc
        clone.draggable = false
        clone.className = "pointer-events-none h-full w-full object-cover"
        moving = clone
        placeholderRef.current = null
        originalStyleRef.current = ""
      } else if (el) {
        originalStyleRef.current = getReturnStyle(el)
        const placeholder = document.createElement("div")
        placeholder.setAttribute("style", originalStyleRef.current)
        placeholder.style.width = `${el.offsetWidth}px`
        placeholder.style.height = `${el.offsetHeight}px`
        placeholderRef.current = placeholder
        el.parentElement?.replaceChild(placeholder, el)
        moving = el
      } else {
        isFocusedRef.current = false
        return
      }
      focusedElRef.current = moving

      const aspect = fromRect.width / fromRect.height
      const frame = document.getElementById("focus-image-frame")
      if (frame) {
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
          frame.style.width = `${tw}px`
          frame.style.height = `${th}px`
          frame.style.top = ""
          frame.style.bottom = ""
        } else {
          // Reserve a band at the top for the collection title and one at the
          // bottom for the info/options strip, then size + centre the image
          // within what's left. <FocusWrapper /> re-measures the strip after it
          // renders and fine-tunes from this estimate.
          const titleTop = 96
          const titleFont = Math.min(Math.max(window.innerWidth * 0.07, 48), 96)
          // Kept in step with <FocusWrapper>'s fitImageFrame: tighter title gap
          // and a larger size cap so the morph target matches the settled size.
          const topReserve = titleTop + titleFont + 11
          const bottomReserve = 240
          const maxW = Math.min(window.innerWidth * 0.45, 550)
          const maxH = Math.max(window.innerHeight - topReserve - bottomReserve, 200)
          let tw = maxW
          let th = tw / aspect
          if (th > maxH) {
            th = maxH
            tw = th * aspect
          }
          frame.style.width = `${tw}px`
          frame.style.height = `${th}px`
          frame.style.top = `${topReserve}px`
          frame.style.bottom = `${bottomReserve}px`
        }
      }

      flushSync(() => setFocusedProduct(product))
      const toRect = slot.getBoundingClientRect()

      document.body.appendChild(moving)
      gsap.killTweensOf(moving)
      gsap.set(moving, { position: "fixed", margin: 0, zIndex: 900, scale: 1 })

      if (shiftElRef.current) {
        gsap.to(shiftElRef.current, {
          x: `${shiftFraction() * 100}vw`,
          duration: 1.1,
          ease: "expo.inOut",
        })
      }

      gsap.fromTo(
        moving,
        { left: fromRect.left, top: fromRect.top, width: fromRect.width, height: fromRect.height },
        {
          left: toRect.left,
          top: toRect.top,
          width: toRect.width,
          height: toRect.height,
          duration: 1.1,
          ease: "expo.inOut",
          onComplete: () => {
            slot.appendChild(moving)
            gsap.set(moving, { clearProps: "position,top,left,zIndex,margin" })
            moving.style.width = ""
            moving.style.height = ""
          },
        },
      )
    },
    [],
  )

  // Open a product, switching cleanly if one is already focused. Canvas/grid
  // pieces pass their real element; cart/upsell thumbnails pass a null element
  // plus `opts` (cloneSrc + fromRect) so a clone flies in without detaching the
  // React-owned thumbnail.
  const openProduct = useCallback(
    (
      product: Product,
      el: HTMLElement | null,
      shiftEl?: HTMLElement | null,
      opts?: { cloneSrc?: string; fromRect?: DOMRect },
    ) => {
      if (!isFocusedRef.current) {
        beginFocus(product, el, shiftEl, opts)
        return
      }

      // Already focused: tidy the current piece back to its origin (instantly),
      // then morph the new one in. Keep the existing background shift so the
      // slid-aside canvas/page isn't left stranded.
      const keepShift = shiftElRef.current
      const cur = focusedElRef.current
      const placeholder = placeholderRef.current
      if (cur) {
        gsap.killTweensOf(cur)
        if (placeholder?.parentElement) {
          placeholder.parentElement.replaceChild(cur, placeholder)
          gsap.set(cur, { clearProps: "all" })
          cur.setAttribute("style", originalStyleRef.current)
        } else {
          cur.remove()
        }
      }
      placeholderRef.current = null
      focusedElRef.current = null
      isFocusedRef.current = false
      beginFocus(product, el, keepShift, opts)
    },
    [beginFocus],
  )

  const handleClose = useCallback(() => {
    setArtworkParam(null)
    const el = focusedElRef.current
    const placeholder = placeholderRef.current
    if (!el || !placeholder?.parentElement) {
      // No canvas/page origin to return to (e.g. a cart/upsell clone). Drop any
      // orphaned morph node, glide the slid-aside background back, and let
      // <FocusWrapper /> wipe the panel away.
      const slot = document.getElementById("focus-image-slot")
      if (slot) slot.replaceChildren()
      el?.remove()
      if (shiftElRef.current) {
        gsap.to(shiftElRef.current, { x: 0, duration: 1.1, ease: "expo.inOut" })
      }
      focusedElRef.current = null
      isFocusedRef.current = false
      setFocusedProduct(null)
      return
    }

    const fromRect = el.getBoundingClientRect()

    const shiftEl = shiftElRef.current
    const shift = shiftEl ? window.innerWidth * shiftFraction() : 0
    const pr = placeholder.getBoundingClientRect()
    const toRect = { left: pr.left - shift, top: pr.top, width: pr.width, height: pr.height }

    document.body.appendChild(el)
    gsap.set(el, { position: "fixed", margin: 0, zIndex: 900, scale: 1 })

    if (shiftEl) gsap.to(shiftEl, { x: 0, duration: 1.1, ease: "expo.inOut" })

    gsap.fromTo(
      el,
      { left: fromRect.left, top: fromRect.top, width: fromRect.width, height: fromRect.height },
      {
        left: toRect.left,
        top: toRect.top,
        width: toRect.width,
        height: toRect.height,
        duration: 1.1,
        ease: "expo.inOut",
        onComplete: () => {
          placeholder.parentElement?.replaceChild(el, placeholder)
          placeholderRef.current = null
          gsap.set(el, { clearProps: "all" })
          el.setAttribute("style", originalStyleRef.current)
          focusedElRef.current = null
          isFocusedRef.current = false
          setFocusedProduct(null)
        },
      },
    )
  }, [])

  return { focusedProduct, beginFocus, openProduct, handleClose, isFocusedRef }
}
