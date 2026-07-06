import { useCallback, useRef, useState } from "react"
import { track } from "../lib/analytics"
import { gsap } from "../lib/gsap"
import { emitPopupAction } from "../lib/marketing"
import type { Product } from "../lib/types"

// How far the underlying view (canvas/grid) slides aside so the focus panel can
// take its place.
const CANVAS_SHIFT = "60vw"

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
    (product: Product, el: HTMLElement, shiftEl?: HTMLElement | null) => {
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

      focusedElRef.current = el
      originalStyleRef.current = getReturnStyle(el)

      const fromRect = el.getBoundingClientRect()

      const placeholder = document.createElement("div")
      placeholder.setAttribute("style", originalStyleRef.current)
      placeholder.style.width = `${el.offsetWidth}px`
      placeholder.style.height = `${el.offsetHeight}px`
      placeholderRef.current = placeholder
      el.parentElement?.replaceChild(placeholder, el)

      const aspect = fromRect.width / fromRect.height
      const frame = document.getElementById("focus-image-frame")
      if (frame) {
        // Reserve a band at the top for the collection title and one at the
        // bottom for the info/options strip, then size + centre the image
        // within what's left. <FocusWrapper /> re-measures the strip after it
        // renders and fine-tunes from this estimate.
        const isMd = window.innerWidth >= 768
        const titleTop = isMd ? 96 : 64
        const titleFont = Math.min(Math.max(window.innerWidth * 0.07, 48), 96)
        const topReserve = titleTop + titleFont + 22
        const bottomReserve = 240

        const maxW = Math.min(window.innerWidth * 0.36, 440)
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

      setFocusedProduct(product)
      const toRect = slot.getBoundingClientRect()

      document.body.appendChild(el)
      gsap.killTweensOf(el)
      gsap.set(el, { position: "fixed", margin: 0, zIndex: 900, scale: 1 })

      if (shiftElRef.current) {
        gsap.to(shiftElRef.current, { x: CANVAS_SHIFT, duration: 1.1, ease: "expo.inOut" })
      }

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
            slot.appendChild(el)
            gsap.set(el, { clearProps: "position,top,left,zIndex,margin" })
            el.style.width = ""
            el.style.height = ""
          },
        },
      )
    },
    [],
  )

  const handleClose = useCallback(() => {
    setArtworkParam(null)
    const el = focusedElRef.current
    const placeholder = placeholderRef.current
    if (!el || !placeholder?.parentElement) {
      // No canvas/page origin to return to. Drop any orphaned morph node, glide
      // the slid-aside background back, and let <FocusWrapper /> wipe the panel away.
      const slot = document.getElementById("focus-image-slot")
      if (slot) slot.replaceChildren()
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
    const shift = shiftEl ? window.innerWidth * 0.6 : 0
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

  return { focusedProduct, beginFocus, handleClose, isFocusedRef }
}
