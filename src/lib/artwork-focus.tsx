import { createContext, type ReactNode, type RefObject, useCallback, useContext } from "react"
import { api } from "../../convex/_generated/api"
import { FocusWrapper } from "../components/focus/focus-wrapper"
import { useProductFocus } from "../hooks/use-product-focus"
import { catalogProductToProduct } from "./catalog"
import { convex } from "./convex-client"
import type { Product } from "./types"

type OpenProduct = (product: Product, el: HTMLElement, shiftEl?: HTMLElement | null) => void
// Reopen an artwork straight from a cart/upsell thumbnail. `fromRect` is the
// thumbnail's box (captured on click, before any drawer closes) and `imageSrc`
// the image to fly - a clone is animated so the React-owned thumbnail is safe.
type OpenByHandle = (handle: string, fromRect: DOMRect, imageSrc?: string) => void

type ArtworkFocusValue = {
  focusedProduct: Product | null
  isFocusedRef: RefObject<boolean>
  openProduct: OpenProduct
  openByHandle: OpenByHandle
  close: () => void
}

const ArtworkFocusContext = createContext<ArtworkFocusValue | null>(null)

export function useArtworkFocus() {
  const ctx = useContext(ArtworkFocusContext)
  if (!ctx) throw new Error("useArtworkFocus must be used within an ArtworkFocusProvider")
  return ctx
}

// One focus panel for the whole app. Mounted globally so any surface - the
// canvas, a collection grid, the cart drawer, the upsell set - opens artworks
// into the same morphing panel. Inert (pointer-events:none) until a product is
// focused, so it never interferes with the page beneath it.
export function ArtworkFocusProvider({ children }: { children: ReactNode }) {
  const { focusedProduct, initialImage, openProduct, handleClose, dismissProduct, isFocusedRef } =
    useProductFocus()

  const openByHandle = useCallback<OpenByHandle>(
    (handle, fromRect, imageSrc) => {
      if (!convex) return
      void convex
        .query(api.catalog.getProductByHandle, { handle })
        .then((result) => {
          if (!result) return
          const product = catalogProductToProduct(result)
          openProduct(product, null, null, {
            cloneSrc: imageSrc ?? product.image,
            fromRect,
          })
        })
        .catch(() => {
          // A failed lookup just leaves the thumbnail as-is - nothing to open.
        })
    },
    [openProduct],
  )

  return (
    <ArtworkFocusContext.Provider
      value={{ focusedProduct, isFocusedRef, openProduct, openByHandle, close: handleClose }}
    >
      {children}
      <FocusWrapper
        product={focusedProduct}
        initialImageSrc={initialImage}
        onClose={handleClose}
        onDismiss={dismissProduct}
        onOpenArtwork={openByHandle}
      />
    </ArtworkFocusContext.Provider>
  )
}
