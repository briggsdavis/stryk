import { useEffect, useState } from "react"
import { useShopifyCart } from "../../hooks/use-shopify-cart"
import { HoverLabel } from "./hover-label"

function formatMoney(amount: string | undefined, currencyCode: string | undefined) {
  const value = Number.parseFloat(amount ?? "")
  if (!Number.isFinite(value)) return "$0"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode ?? "USD",
  }).format(value)
}

// Slide-in cart drawer. UI only - there is no cart state yet, so it always shows
// the empty state. Mounts on open and animates in via an `entered` flag (next
// frame after mount) so the CSS transform transition actually runs; on close it
// animates out first, then unmounts after the transition.
export function CartPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [visible, setVisible] = useState(false)
  const [entered, setEntered] = useState(false)
  const { cart, configured, loading, error, checkoutUrl, subtotal, totalQuantity } =
    useShopifyCart()
  const lines = cart?.lines.nodes ?? []

  useEffect(() => {
    if (open) {
      setVisible(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)))
    } else {
      setEntered(false)
      const t = window.setTimeout(() => setVisible(false), 450)
      return () => window.clearTimeout(t)
    }
  }, [open])

  // Esc closes the drawer, matching the click-outside backdrop.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!visible) return null

  return (
    <>
      {/* Backdrop - click anywhere outside the drawer to close */}
      <button
        type="button"
        aria-label="Close cart"
        onClick={onClose}
        className="fixed inset-0 z-[2090] cursor-default bg-dark/35 backdrop-blur-sm transition-opacity duration-[450ms] [transition-timing-function:var(--ease-ui)]"
        style={{ opacity: entered ? 1 : 0 }}
      />

      <aside
        aria-label="Cart"
        className="fixed top-0 right-0 z-[2100] flex h-full w-[26rem] max-w-[calc(100vw-2rem)] flex-col bg-canvas shadow-2xl transition-transform duration-[450ms] [transition-timing-function:var(--ease-ui)]"
        style={{ transform: entered ? "translateX(0)" : "translateX(100%)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dark/10 px-6 py-5">
          <h2 className="text-lg font-medium tracking-tight text-dark">Cart</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="group flex h-9 w-9 items-center justify-center rounded-lg border border-dark/15 text-dark transition-colors duration-300 hover:border-dark/40 hover:bg-dark hover:text-white"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 transition-transform duration-500 [transition-timing-function:var(--ease-ui)] group-hover:rotate-90"
              fill="none"
              aria-hidden="true"
            >
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="1.5" />
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {!configured ? (
            <div className="flex min-h-full flex-col items-center justify-center text-center">
              <p className="text-base font-medium text-dark">Cart unavailable</p>
              <p className="mt-2 max-w-[17rem] text-sm leading-6 text-dark/55">
                Shopify Storefront access is not configured yet.
              </p>
            </div>
          ) : loading && !cart ? (
            <div className="flex min-h-full items-center justify-center text-sm text-dark/55">
              Loading cart...
            </div>
          ) : lines.length === 0 ? (
            <div className="flex min-h-full flex-col items-center justify-center text-center">
              <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-dark/15 text-dark/50">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
                  <path
                    d="M2.5 3.5H5l1.8 9.2a1.2 1.2 0 0 0 1.18.95h7.3a1.2 1.2 0 0 0 1.17-.9l1.45-5.6H6.2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="9" cy="19" r="1.5" fill="currentColor" />
                  <circle cx="16" cy="19" r="1.5" fill="currentColor" />
                </svg>
              </span>
              <p className="text-base font-medium text-dark">Nothing here yet</p>
              <p className="mt-2 max-w-[15rem] text-sm leading-6 text-dark/55">
                Your cart is empty. Keep exploring the archives and add a piece you love.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="group mt-6 inline-flex rounded-lg border border-dark/20 px-5 py-2.5 text-sm font-medium text-dark transition-colors duration-300 hover:border-dark/40 hover:bg-dark hover:text-white"
              >
                <HoverLabel>Keep shopping</HoverLabel>
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {lines.map((line) => (
                <div key={line.id} className="grid grid-cols-[4.5rem_1fr] gap-4">
                  <div className="aspect-square overflow-hidden rounded-sm bg-dark/[0.04]">
                    {line.merchandise.image && (
                      <img
                        src={line.merchandise.image.url}
                        alt={line.merchandise.image.altText ?? line.merchandise.product.title}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="truncate text-sm font-medium text-dark">
                      {line.merchandise.product.title}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-dark/50">
                      {line.merchandise.selectedOptions.map((option) => option.value).join(" / ")}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-xs text-dark/60">
                      <span>Qty {line.quantity}</span>
                      <span className="font-medium text-dark">
                        {formatMoney(
                          line.merchandise.price.amount,
                          line.merchandise.price.currencyCode,
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-dark/10 px-6 py-5">
          <div className="mb-4 flex items-center justify-between text-sm">
            <span className="text-dark/55">
              Subtotal{totalQuantity ? ` (${totalQuantity})` : ""}
            </span>
            <span className="font-medium text-dark">
              {formatMoney(subtotal?.amount, subtotal?.currencyCode)}
            </span>
          </div>
          <a
            href={checkoutUrl ?? undefined}
            target={checkoutUrl ? "_blank" : undefined}
            rel="noopener noreferrer"
            aria-disabled={!checkoutUrl}
            className={`group flex w-full items-center justify-center rounded-lg px-5 py-3.5 text-sm font-medium text-white transition-opacity duration-300 ${
              checkoutUrl ? "bg-dark hover:opacity-80" : "pointer-events-none bg-dark/25"
            }`}
          >
            <HoverLabel>Proceed to checkout</HoverLabel>
          </a>
        </div>
      </aside>
    </>
  )
}
