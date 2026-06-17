import { clsx } from "clsx"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useLocation } from "react-router"
import type { ActiveFilters, FilterGroup, FilterKey } from "../../lib/filters"
import { gsap } from "../../lib/gsap"
import { useTransitionNavigate } from "../../lib/transition"
import type { ViewMode } from "../../lib/types"
import { FilterControl } from "./filter-control"
import { CAPSULE, ROUND_CLOSE } from "./pill"

interface NavbarProps {
  viewMode?: ViewMode
  onToggleView?: () => void
  showViewToggle?: boolean
  showCta?: boolean
  // Canvas filter — only supplied on the home/canvas view.
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

// Even 3×3 grid of dots — represents the grid view.
const GRID_DOTS = [5, 12, 19].flatMap((y) => [5, 12, 19].map((x) => [x, y] as const))
// Loose, organic scatter — represents the infinite-canvas experience view.
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

function HamburgerIcon() {
  return (
    <span className="flex flex-col items-center gap-1.5">
      <span className="block h-px w-5 bg-current" />
      <span className="block h-px w-5 bg-current" />
      <span className="block h-px w-5 bg-current" />
    </span>
  )
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none">
      <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="1.5" />
      <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="1.5" />
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
  const menuRef = useRef<HTMLDivElement>(null)
  const topPillRef = useRef<HTMLButtonElement>(null)
  const togglerContentRef = useRef<HTMLSpanElement>(null)
  const prevWidthRef = useRef<number | null>(null)
  const firstRunRef = useRef(true)
  const ctaFirstRunRef = useRef(true)

  // ── Mini-menu open/close — items slide in horizontally to the right ────────
  useEffect(() => {
    const menu = menuRef.current
    if (!menu) return

    if (menuOpen) {
      gsap.set(menu, { display: "flex", pointerEvents: "all" })
      const items = menu.querySelectorAll<HTMLElement>("a, button")
      gsap.fromTo(
        items,
        { x: -16, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.35, stagger: 0.05, ease: "power3.out" },
      )
    } else {
      const items = menu.querySelectorAll<HTMLElement>("a, button")
      gsap.to(items, {
        x: -10,
        opacity: 0,
        duration: 0.2,
        stagger: 0.03,
        ease: "power2.in",
        onComplete: () => gsap.set(menu, { display: "none", pointerEvents: "none" }),
      })
    }
  }, [menuOpen])

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

  return (
    <>
      {/* Top-left logo */}
      <div className="fixed top-6 left-6 z-[500] md:left-10">
        <button
          onClick={() => transitionNavigate("/")}
          aria-label="Stryk — home"
          className="opacity-80 transition-opacity hover:opacity-100"
        >
          <img src="/stryklogo.png" alt="Stryk" className="h-7 w-auto md:h-8" />
        </button>
      </div>

      {/* Top-center: view toggle — single capsule, dots left of label */}
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
              <span>{viewMode === "xp" ? "grid view" : "canvas view"}</span>
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
        {/* Menu group — trigger morphs to a round X, links expand to the right */}
        <div className="flex items-center gap-2">
          {menuOpen ? (
            <button
              onClick={() => setPanel("none")}
              className={ROUND_CLOSE}
              aria-label="Close menu"
            >
              <XIcon />
            </button>
          ) : (
            <button
              onClick={() => setPanel("menu")}
              className={CAPSULE}
              aria-label="Open menu"
              aria-expanded={false}
            >
              <HamburgerIcon />
              <span>menu</span>
            </button>
          )}

          <div ref={menuRef} className="flex items-center gap-2" style={{ display: "none" }}>
            {LINKS.map(({ label, to }) => {
              const isActive = location.pathname === to
              return (
                <button
                  key={to}
                  onClick={() => handleLinkClick(to)}
                  className="flex items-center gap-1.5 rounded-lg bg-dark px-5 py-3 text-sm font-medium whitespace-nowrap text-white transition-colors duration-200 hover:bg-dark/80"
                >
                  {isActive && <span className="block h-1.5 w-1.5 rounded-full bg-white" />}
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Filter group — canvas view only; hidden while the menu is open */}
        {showFilter && filterGroups && activeFilters && onToggleFilter && onClearFilters && (
          <div
            className={clsx(
              "transition-opacity duration-300",
              menuOpen && "pointer-events-none opacity-0",
            )}
          >
            <FilterControl
              open={panel === "filter"}
              onToggleOpen={() => setPanel((p) => (p === "filter" ? "none" : "filter"))}
              groups={filterGroups}
              active={activeFilters}
              onToggleOption={onToggleFilter}
              onClear={onClearFilters}
            />
          </div>
        )}
      </div>
    </>
  )
}
