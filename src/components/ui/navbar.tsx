import { clsx } from "clsx"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useLocation } from "react-router"
import type { ActiveFilters, FilterGroup, FilterKey } from "../../lib/filters"
import { gsap } from "../../lib/gsap"
import { useTransitionNavigate } from "../../lib/transition"
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
  { label: "Collections", to: "/" },
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
]

// Even 3×3 grid of dots - represents the grid view.
const GRID_DOTS = [5, 12, 19].flatMap((y) => [5, 12, 19].map((x) => [x, y] as const))
// Loose, organic scatter - represents the infinite-canvas experience view.
const SCATTER_DOTS = [
  [6, 5],
  [13, 4],
  [19, 8],
  [9, 12],
  [16, 13],
  [7, 18],
  [14, 19],
] as const

function DotIcon({ dots }: { dots: ReadonlyArray<readonly [number, number]> }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] transition-transform duration-700 ease-out group-hover:rotate-90"
      aria-hidden="true"
    >
      {dots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.7" fill="currentColor" />
      ))}
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
  const location = useLocation()
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
      {/* Top-left logo */}
      <div className="fixed top-6 left-6 z-[500] md:left-10">
        <button
          onClick={() => transitionNavigate("/")}
          aria-label="Stryk - home"
          className="opacity-80 transition-opacity hover:opacity-100"
        >
          <img src="/stryklogo.png" alt="Stryk" className="h-7 w-auto md:h-8" />
        </button>
      </div>

      {/* Top-center: view toggle - single capsule, dots left of label */}
      {showViewToggle && viewMode && onToggleView && (
        <div className="fixed top-5 left-1/2 z-[500] -translate-x-1/2">
          <button
            ref={topPillRef}
            onClick={onToggleView}
            aria-label={viewMode === "xp" ? "Switch to grid view" : "Switch to experience view"}
            className={CAPSULE}
          >
            <span ref={togglerContentRef} className="flex items-center gap-2.5">
              <DotIcon dots={viewMode === "xp" ? GRID_DOTS : SCATTER_DOTS} />
              <HoverLabel>{viewMode === "xp" ? "grid view" : "canvas view"}</HoverLabel>
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
          label="menu"
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
            label="filter"
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
