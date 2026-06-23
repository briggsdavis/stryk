import { clsx } from "clsx"
import { useQuery } from "convex/react"
import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react"
import { useLocation } from "react-router"
import { api } from "../../../convex/_generated/api"
import type { ActiveFilters, FilterGroup, FilterKey } from "../../lib/filters"
import { gsap } from "../../lib/gsap"
import { useTransitionBack, useTransitionNavigate } from "../../lib/transition"
import type { ViewMode } from "../../lib/types"
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

// Hover: the bars retract to staggered lengths for a subtle "reflow".
function HamburgerIcon() {
  const bar =
    "block h-px w-5 bg-current transition-all duration-300 [transition-timing-function:var(--ease-ui)]"
  return (
    <span className="flex flex-col items-center gap-1.5">
      <span className={`${bar} group-hover:w-3`} />
      <span className={`${bar} group-hover:w-5`} />
      <span className={`${bar} group-hover:w-3.5`} />
    </span>
  )
}

// Hover: the two knobs slide across their tracks and swap sides.
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
  // When the announcement bar is live it occupies the top edge, so nudge the
  // logo and view toggle down to clear it (with a little breathing room).
  const announcement = useQuery(api.marketing.activeAnnouncement, {
    route: location.pathname === "/" ? "home" : "other",
  })
  const barActive = !!announcement
  const [panel, setPanel] = useState<Panel>("none")
  const menuOpen = panel === "menu"
  const topPillRef = useRef<HTMLButtonElement>(null)
  const togglerContentRef = useRef<HTMLSpanElement>(null)
  const prevWidthRef = useRef<number | null>(null)
  const firstRunRef = useRef(true)
  const ctaFirstRunRef = useRef(true)

  // ── Morph the top view-toggle on label change ──────────────────────────────
  // The top toggle changes label ("grid view" ↔ "canvas view"), so its natural
  // width changes. Morph the pill to its new width and crossfade its contents.
  useLayoutEffect(() => {
    const top = topPillRef.current
    if (!top) return

    const prevW = prevWidthRef.current
    top.style.width = "auto"
    const targetW = Math.ceil(top.getBoundingClientRect().width)
    prevWidthRef.current = targetW

    if (firstRunRef.current || prevW == null) {
      firstRunRef.current = false
      top.style.width = `${targetW}px`
      return
    }

    gsap.fromTo(top, { width: prevW }, { width: targetW, duration: 0.5, ease: "expo.out" })
    if (togglerContentRef.current) {
      gsap.fromTo(
        togglerContentRef.current,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" },
      )
    }
  }, [viewMode, showViewToggle])

  // ── Collapse panels when a product is focused ──────────────────────────────
  useEffect(() => {
    if (ctaFirstRunRef.current) {
      ctaFirstRunRef.current = false
      return
    }
    if (showCta) setPanel("none")
  }, [showCta])

  const handleLinkClick = (to: string) => {
    setPanel("none")
    transitionNavigate(to)
  }

  const hideForFocus = showCta
  const hasFilter = showFilter && filterGroups && activeFilters && onToggleFilter && onClearFilters

  return (
    <>
      {/* Top-left: logo + (on nested pages) a back button */}
      <div
        className="fixed top-6 left-6 z-[500] flex items-center gap-3 transition-[top] duration-300 md:left-10"
        style={barActive ? { top: "3.5rem" } : undefined}
      >
        <button
          onClick={() => transitionNavigate("/")}
          aria-label="Stryk - home"
          className="opacity-80 transition-opacity hover:opacity-100"
        >
          <img src="/stryklogo.png" alt="Stryk" className="h-7 w-auto md:h-8" />
        </button>
        {showBack && (
          <button
            onClick={transitionBack}
            aria-label="Go back"
            className="group flex items-center gap-1.5 rounded-lg border border-dark/15 bg-canvas px-3 py-2 text-sm font-medium text-dark transition-colors duration-300 hover:border-dark/40 hover:bg-dark hover:text-white"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-0.5"
              aria-hidden="true"
            >
              <path
                d="M10 3l-5 5 5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <HoverLabel>Back</HoverLabel>
          </button>
        )}
      </div>

      {/* Top-center: view toggle - single capsule, dots left of label */}
      {showViewToggle && viewMode && onToggleView && (
        <div
          className="fixed top-5 left-1/2 z-[500] -translate-x-1/2 transition-[top] duration-300"
          style={barActive ? { top: "3.5rem" } : undefined}
        >
          <button
            ref={topPillRef}
            onClick={onToggleView}
            aria-label={viewMode === "xp" ? "Switch to grid view" : "Switch to experience view"}
            className={CAPSULE}
          >
            <span ref={togglerContentRef} className="flex items-center gap-2.5">
              <MorphDotIcon toGrid={viewMode === "xp"} />
              <HoverLabel>{viewMode === "xp" ? "Grid View" : "Canvas View"}</HoverLabel>
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
              <button
                key={to}
                onClick={() => handleLinkClick(to)}
                className="group flex items-center gap-1.5 rounded-lg bg-dark px-5 py-3 text-sm font-medium whitespace-nowrap text-white"
              >
                {isActive && <span className="block h-1.5 w-1.5 rounded-full bg-white" />}
                <HoverLabel>{label}</HoverLabel>
              </button>
            )
          })}
        </ExpandingControl>

        {/* Filter - canvas view only; dimmed while the menu is open */}
        {hasFilter && (
          <ExpandingControl
            open={panel === "filter"}
            onToggle={() => setPanel((p) => (p === "filter" ? "none" : "filter"))}
            icon={<SlidersIcon />}
            label="Filter"
            ariaLabel={panel === "filter" ? "Close filters" : "Open filters"}
            dimmed={menuOpen}
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
      </div>
    </>
  )
}
