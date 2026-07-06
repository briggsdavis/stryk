import { clsx } from "clsx"
import { type CSSProperties, type MouseEvent, useEffect, useRef, useState } from "react"
import { Link, useLocation } from "react-router"
import type { ActiveFilters, FilterGroup, FilterKey } from "../../lib/filters"
import { useTransitionBack, useTransitionNavigate } from "../../lib/transition"
import type { ViewMode } from "../../lib/types"
import { CartPanel } from "./cart-panel"
import { ExpandingControl } from "./expanding-control"
import { FilterPills } from "./filter-pills"
import { HoverLabel } from "./hover-label"
import { CAPSULE } from "./pill"

interface NavbarProps {
  viewMode?: ViewMode
  onToggleView?: () => void
  showViewToggle?: boolean
  showCta?: boolean
  // Canvas filter - only supplied on the home/canvas view.
  showFilter?: boolean
  filterGroups?: FilterGroup[]
  activeFilters?: ActiveFilters
  onToggleFilter?: (key: FilterKey, value: string) => void
  onClearFilters?: () => void
}

const LINKS = [
  { label: "artworks", to: "/" },
  { label: "collections", to: "/collections" },
  { label: "about", to: "/about" },
  { label: "contact", to: "/contact" },
]
const VIEW_TOGGLE_LABELS = ["Grid View", "Canvas View"] as const

// Two icons that morph into one another. The grid view is an even 3×3 grid of 9
// dots; the canvas view is a 7-dot circle of three columns (2 · 3 · 2). Each row
// pairs a grid position with its circle position; the grid's two side-middle dots
// have no circle counterpart, so they fade out (opacity 0) when morphing to the
// circle (and fade back in toward the grid). Columns: x 5/6, 12, 18/19.
type DotMorph = readonly [
  gridX: number,
  gridY: number,
  circX: number,
  circY: number,
  circVisible: 0 | 1,
]
const DOTS: readonly DotMorph[] = [
  [5, 5, 6, 8, 1], // top-left → circle left-top
  [12, 5, 12, 4, 1], // top-center → circle center-top
  [19, 5, 18, 8, 1], // top-right → circle right-top
  [5, 12, 6, 12, 0], // mid-left → fades out
  [12, 12, 12, 12, 1], // center → circle center-mid
  [19, 12, 18, 12, 0], // mid-right → fades out
  [5, 19, 6, 16, 1], // bottom-left → circle left-bottom
  [12, 19, 12, 20, 1], // bottom-center → circle center-bottom
  [19, 19, 18, 16, 1], // bottom-right → circle right-bottom
]

// Shows the destination view's icon at rest and morphs to the other on hover, so
// hovering previews the switch. `toGrid` = the destination is the grid view.
function MorphDotIcon({ toGrid }: { toGrid: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
      {DOTS.map(([gx, gy, cx, cy, circVisible], i) => {
        const restX = toGrid ? gx : cx
        const restY = toGrid ? gy : cy
        const restO = toGrid ? 1 : circVisible
        const hoverX = toGrid ? cx : gx
        const hoverY = toGrid ? cy : gy
        const hoverO = toGrid ? circVisible : 1
        return (
          <circle
            key={i}
            cx={restX}
            cy={restY}
            r="1.7"
            fill="currentColor"
            className="opacity-[var(--o0)] transition-[transform,opacity] duration-500 [transition-timing-function:var(--ease-ui)] group-hover:[transform:translate(var(--dx),var(--dy))] group-hover:opacity-[var(--o)]"
            style={
              {
                "--dx": `${hoverX - restX}px`,
                "--dy": `${hoverY - restY}px`,
                "--o0": `${restO}`,
                "--o": `${hoverO}`,
              } as CSSProperties
            }
          />
        )
      })}
    </svg>
  )
}

function HamburgerIcon() {
  const bar =
    "block h-px bg-current transition-[width] duration-300 [transition-timing-function:var(--ease-ui)]"
  return (
    <span className="flex h-[18px] w-[18px] flex-col items-center justify-center gap-1">
      <span className={`${bar} w-3 group-hover:w-2`} />
      <span className={`${bar} w-3 group-hover:w-3`} />
      <span className={`${bar} w-3 group-hover:w-2`} />
    </span>
  )
}

function SlidersIcon() {
  const knob =
    "fill-current transition-transform duration-300 [transform-box:fill-box] [transition-timing-function:var(--ease-ui)]"
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true" fill="none">
      <line x1="4" y1="8" x2="20" y2="8" stroke="currentColor" strokeWidth="1.5" />
      <line x1="4" y1="16" x2="20" y2="16" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="8" r="2.6" className={`${knob} group-hover:translate-x-[6px]`} />
      <circle cx="15" cy="16" r="2.6" className={`${knob} group-hover:-translate-x-[6px]`} />
    </svg>
  )
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true" fill="none">
      <path
        d="M2.5 3.5H5l1.8 9.2a1.2 1.2 0 0 0 1.18.95h7.3a1.2 1.2 0 0 0 1.17-.9l1.45-5.6H6.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8.55" cy="19" r="1.5" className="fill-current" />
      <circle cx="15.55" cy="19" r="1.5" className="fill-current" />
    </svg>
  )
}

type Panel = "none" | "menu" | "filter"

export function Navbar({
  viewMode,
  onToggleView,
  showViewToggle,
  showCta,
  showFilter,
  filterGroups,
  activeFilters,
  onToggleFilter,
  onClearFilters,
}: NavbarProps) {
  const transitionNavigate = useTransitionNavigate()
  const transitionBack = useTransitionBack()
  const location = useLocation()
  // The individual collection page (/collection/:slug) is the one nested route -
  // not reachable from the menu - so it's the only page that needs a back button.
  // ("/collections" is the menu-reachable index and intentionally doesn't match.)
  const showBack = location.pathname.startsWith("/collection/")
  const [panel, setPanel] = useState<Panel>("none")
  const [cartOpen, setCartOpen] = useState(false)
  const menuOpen = panel === "menu"
  const ctaFirstRunRef = useRef(true)

  // ── Collapse panels when a product is focused ──────────────────────────────
  useEffect(() => {
    if (ctaFirstRunRef.current) {
      ctaFirstRunRef.current = false
      return
    }
    if (showCta) setPanel("none")
  }, [showCta])

  const handleLinkClick = (event: MouseEvent<HTMLAnchorElement>, to: string) => {
    setPanel("none")
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
    transitionNavigate(to)
  }

  const hideForFocus = showCta
  const hasFilter = showFilter && filterGroups && activeFilters && onToggleFilter && onClearFilters

  return (
    <>
      {/* Top-left: logo */}
      <div className="site-top-6 fixed left-6 z-[500] flex items-center gap-3 transition-[top] duration-300 md:left-10">
        <button
          onClick={() => transitionNavigate("/")}
          aria-label="Stryk - home"
          className="cursor-pointer opacity-80 transition-opacity hover:opacity-100"
        >
          <img
            src="/stryk-logo-128.png"
            alt="Stryk"
            width={32}
            height={32}
            className="h-7 w-auto md:h-8"
          />
        </button>
      </div>

      {/* Top-center: view toggle - single capsule, dots left of label */}
      {showViewToggle && viewMode && onToggleView && (
        <div className="site-top-5 fixed left-1/2 z-[500] -translate-x-1/2 transition-[top] duration-300">
          <button
            onClick={onToggleView}
            aria-label={viewMode === "xp" ? "Switch to grid view" : "Switch to experience view"}
            className={CAPSULE}
          >
            <span className="flex items-center gap-2.5">
              <MorphDotIcon toGrid={viewMode === "xp"} />
              <span className="inline-grid">
                <HoverLabel className="col-start-1 row-start-1">
                  {viewMode === "xp" ? VIEW_TOGGLE_LABELS[0] : VIEW_TOGGLE_LABELS[1]}
                </HoverLabel>
                <span aria-hidden="true" className="invisible col-start-1 row-start-1 -mx-1 px-1">
                  {VIEW_TOGGLE_LABELS[1]}
                </span>
              </span>
            </span>
          </button>
        </div>
      )}

      {/* Bottom-center: menu + filter controls */}
      <div
        className={clsx(
          "fixed bottom-8 left-1/2 z-[600] flex -translate-x-1/2 items-center gap-2 transition-opacity duration-300",
          hideForFocus && "pointer-events-none opacity-0",
        )}
      >
        {/* Back - on nested pages (the individual collection page), sits in line
            with the menu/cart controls. Styled to match them. */}
        {showBack && (
          <button
            onClick={transitionBack}
            aria-label="Go back"
            className="group flex h-[42px] shrink-0 items-center justify-center gap-2.5 overflow-hidden rounded-lg border border-dark/15 bg-canvas px-4 text-sm font-medium whitespace-nowrap text-dark transition-[background-color,border-color,color] duration-300 hover:border-dark/40 hover:bg-dark hover:text-white"
          >
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
              <svg viewBox="0 0 16 16" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
                <path
                  d="M10 3l-5 5 5 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <HoverLabel>Back</HoverLabel>
          </button>
        )}

        {/* Menu - links slide out to the right as the trigger glides aside */}
        <ExpandingControl
          open={menuOpen}
          onToggle={() => setPanel((p) => (p === "menu" ? "none" : "menu"))}
          icon={<HamburgerIcon />}
          label="Menu"
          ariaLabel={menuOpen ? "Close menu" : "Open menu"}
        >
          {LINKS.map(({ label, to }) => {
            const isActive = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                onClick={(event) => handleLinkClick(event, to)}
                aria-current={isActive ? "page" : undefined}
                className="group relative flex items-center justify-center rounded-lg bg-dark px-5 py-3 text-center text-sm font-medium whitespace-nowrap text-white"
              >
                {isActive && (
                  <span className="absolute left-3 block h-1.5 w-1.5 rounded-full bg-white" />
                )}
                <HoverLabel>{label}</HoverLabel>
              </Link>
            )
          })}
        </ExpandingControl>

        {/* Filter - canvas view only */}
        {hasFilter && (
          <ExpandingControl
            open={panel === "filter"}
            onToggle={() => setPanel((p) => (p === "filter" ? "none" : "filter"))}
            icon={<SlidersIcon />}
            label="Filter"
            ariaLabel={panel === "filter" ? "Close filters" : "Open filters"}
          >
            <FilterPills
              groups={filterGroups}
              active={activeFilters}
              onToggleOption={onToggleFilter}
              onClear={onClearFilters}
              popoverSide="top"
            />
          </ExpandingControl>
        )}

        {/* Cart - opens the slide-in drawer. Styled to match the closed
            menu/filter triggers so the three read as one bar. */}
        <button
          onClick={() => {
            setPanel("none")
            setCartOpen(true)
          }}
          aria-label="Open cart"
          className="group flex h-[42px] shrink-0 items-center justify-center gap-2.5 overflow-hidden rounded-lg border border-dark/15 bg-canvas px-4 text-sm font-medium whitespace-nowrap text-dark transition-[background-color,border-color,color] duration-300 hover:border-dark/40 hover:bg-dark hover:text-white"
        >
          <span className="flex shrink-0 items-center">
            <CartIcon />
          </span>
          <HoverLabel>Cart</HoverLabel>
        </button>
      </div>

      <CartPanel open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  )
}
