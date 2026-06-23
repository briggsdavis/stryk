import { useCallback, useRef, useState } from "react"
import { gsap } from "../lib/gsap"
import { emitPopupAction } from "../lib/marketing"
import type { Product } from "../lib/types"

// How far the underlying view (canvas/grid) slides aside so the focus panel can
// take its place.
const CANVAS_SHIFT = "60vw"

// Shared "open a product into the focus panel" morph. The clicked element flies
// from its on-screen spot into #focus-image-slot (rendered by <FocusWrapper />),
// leaving a placeholder behind so the source layout doesn't reflow; closing
// reverses it. Optionally slides a background element aside during the morph.
export function useProductFocus() {
  const [focusedProduct, setFocusedProduct] = useState<Product | null>(null)
  const focusedElRef = useRef<HTMLElement | null>(null)
  const placeholderRef = useRef<HTMLElement | null>(null)
  const originalSizeRef = useRef<{ w: string; h: string }>({ w: "", h: "" })
  const isFocusedRef = useRef(false)
  const shiftElRef = useRef<HTMLElement | null>(null)

  const beginFocus = useCallback(
    (product: Product, el: HTMLElement, shiftEl?: HTMLElement | null) => {
      if (isFocusedRef.current) return
      emitPopupAction("product")
      isFocusedRef.current = true
      shiftElRef.current = shiftEl ?? null

      const slot = document.getElementById("focus-image-slot")
      if (!slot) {
        isFocusedRef.current = false
        return
      }

      focusedElRef.current = el
      originalSizeRef.current = { w: el.style.width, h: el.style.height }

      const fromRect = el.getBoundingClientRect()

      const placeholder = document.createElement("div")
      placeholder.style.width = `${el.offsetWidth}px`
      placeholder.style.height = `${el.offsetHeight}px`
      placeholder.style.flexShrink = "0"
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
      gsap.set(el, { position: "fixed", margin: 0, zIndex: 9000, scale: 1 })

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
    const el = focusedElRef.current
    const placeholder = placeholderRef.current
    if (!el || !placeholder?.parentElement) {
      // No canvas/page origin to return to (e.g. closing after switching to a
      // recommendation). Drop any orphaned morph node, glide the slid-aside
      // background back, and let <FocusWrapper /> wipe the panel away.
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
    gsap.set(el, { position: "fixed", margin: 0, zIndex: 9000, scale: 1 })

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
          gsap.set(el, { clearProps: "top,left,zIndex,margin" })
          el.style.position = "relative"
          el.style.width = originalSizeRef.current.w
          el.style.height = originalSizeRef.current.h
          focusedElRef.current = null
          isFocusedRef.current = false
          setFocusedProduct(null)
        },
      },
    )
  }, [])

  // Switch the focus to a different product (a recommended piece clicked in the
  // upsell panel) without closing first. The current piece is returned to its
  // origin instantly, then a clone of the clicked piece morphs into the focus
  // slot. The new piece has no origin of its own, so closing afterwards just
  // wipes the panel (see handleClose's no-origin branch).
  const switchFocus = useCallback((product: Product, el: HTMLElement) => {
    if (!isFocusedRef.current) return
    const slot = document.getElementById("focus-image-slot")
    if (!slot) return

    // Detach whatever currently occupies the slot.
    const prevEl = focusedElRef.current
    const prevPlaceholder = placeholderRef.current
    if (prevEl) gsap.killTweensOf(prevEl)
    if (prevEl && prevPlaceholder?.parentElement) {
      // A real canvas/page node: put it back where it came from.
      prevPlaceholder.parentElement.replaceChild(prevEl, prevPlaceholder)
      gsap.set(prevEl, { clearProps: "position,top,left,zIndex,margin,transform" })
      prevEl.style.position = "relative"
      prevEl.style.width = originalSizeRef.current.w
      prevEl.style.height = originalSizeRef.current.h
    } else if (prevEl) {
      // An orphaned clone left by an earlier switch.
      prevEl.remove()
    }
    placeholderRef.current = null

    // Morph a clone of the clicked recommendation from its slot into the frame.
    const fromRect = el.getBoundingClientRect()
    const clone = el.cloneNode(true) as HTMLElement
    document.body.appendChild(clone)
    gsap.set(clone, {
      position: "fixed",
      margin: 0,
      zIndex: 9000,
      left: fromRect.left,
      top: fromRect.top,
      width: fromRect.width,
      height: fromRect.height,
      objectFit: "cover",
    })
    focusedElRef.current = clone
    originalSizeRef.current = { w: "", h: "" }

    setFocusedProduct(product)

    const toRect = slot.getBoundingClientRect()
    gsap.to(clone, {
      left: toRect.left,
      top: toRect.top,
      width: toRect.width,
      height: toRect.height,
      duration: 1.0,
      ease: "expo.inOut",
      onComplete: () => {
        slot.appendChild(clone)
        gsap.set(clone, { clearProps: "all" })
        clone.style.width = "100%"
        clone.style.height = "100%"
        clone.style.objectFit = "cover"
      },
    })
  }, [])

  return { focusedProduct, beginFocus, switchFocus, handleClose, isFocusedRef }
}
