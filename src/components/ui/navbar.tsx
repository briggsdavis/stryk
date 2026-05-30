import { clsx } from "clsx"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Link } from "react-router"
import { gsap } from "../../lib/gsap"
import type { ViewMode } from "../../lib/types"

interface NavbarProps {
  viewMode?: ViewMode
  onToggleView?: () => void
  showViewToggle?: boolean
}

const LINKS = [
  { label: "Collection", to: "/" },
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

// Shared capsule styling for the top view-toggle and the bottom menu button,
// so they read as the same component. Hover inverts to dark.
const CAPSULE =
  "group flex items-center justify-center gap-2.5 overflow-hidden whitespace-nowrap rounded-lg border border-dark/15 bg-canvas px-4 py-2.5 text-sm font-medium text-dark transition-colors duration-300 hover:border-dark/40 hover:bg-dark hover:text-white"

export function Navbar({ viewMode, onToggleView, showViewToggle }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const topPillRef = useRef<HTMLButtonElement>(null)
  const bottomPillRef = useRef<HTMLButtonElement>(null)
  const togglerContentRef = useRef<HTMLSpanElement>(null)
  const prevWidthRef = useRef<number | null>(null)
  const firstRunRef = useRef(true)

  // ── Mini-menu open/close ───────────────────────────────────────────────
  useEffect(() => {
    const menu = menuRef.current
    if (!menu) return

    if (menuOpen) {
      gsap.set(menu, { display: "flex", pointerEvents: "all" })
      const items = menu.querySelectorAll<HTMLElement>("a, button")
      gsap.fromTo(
        items,
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.35, stagger: 0.05, ease: "power3.out" },
      )
    } else {
      const items = menu.querySelectorAll<HTMLElement>("a, button")
      gsap.to(items, {
        y: 10,
        opacity: 0,
        duration: 0.2,
        stagger: 0.03,
        ease: "power2.in",
        onComplete: () => gsap.set(menu, { display: "none", pointerEvents: "none" }),
      })
    }
  }, [menuOpen])

  // ── Capsule width sync + morph on view toggle ──────────────────────────
  // The top toggle changes label ("grid view" ↔ "experience view"), so its
  // natural width changes. We morph the top pill to its new width and morph the
  // bottom "menu" pill to match it, and crossfade the toggle's contents.
  useLayoutEffect(() => {
    const top = topPillRef.current
    if (!top) return
    const bottom = bottomPillRef.current

    const prevW = prevWidthRef.current
    top.style.width = "auto"
    const targetW = Math.ceil(top.getBoundingClientRect().width)
    prevWidthRef.current = targetW

    // First time the toggle appears: set widths instantly, no morph.
    if (firstRunRef.current || prevW == null) {
      firstRunRef.current = false
      top.style.width = `${targetW}px`
      if (bottom) bottom.style.width = `${targetW}px`
      return
    }

    gsap.fromTo(top, { width: prevW }, { width: targetW, duration: 0.5, ease: "expo.out" })
    if (bottom) {
      gsap.fromTo(
        bottom,
        { width: bottom.offsetWidth },
        { width: targetW, duration: 0.5, ease: "expo.out" },
      )
    }
    if (togglerContentRef.current) {
      gsap.fromTo(
        togglerContentRef.current,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" },
      )
    }
  }, [viewMode, showViewToggle])

  const close = () => setMenuOpen(false)

  return (
    <>
      {/* Top-left logo */}
      <div className="fixed top-6 left-6 z-[500] md:left-10">
        <Link
          to="/"
          className="text-xs font-medium tracking-[0.2em] text-dark/80 uppercase hover:text-dark"
        >
          Stryk
        </Link>
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
              <span>{viewMode === "xp" ? "grid view" : "experience view"}</span>
            </span>
          </button>
        </div>
      )}

      {/* Bottom-center: menu capsule + expanding mini-menu above it */}
      <div className="fixed bottom-8 left-1/2 z-[600] flex -translate-x-1/2 flex-col items-center gap-2">
        {/* Mini-menu items — slide up above the capsule */}
        <div
          ref={menuRef}
          className="flex flex-col items-center gap-1.5 pb-1"
          style={{ display: "none" }}
        >
          {LINKS.map(({ label, to }) => (
            <Link
              key={to}
              to={to}
              onClick={close}
              className="block border border-dark/20 bg-canvas px-5 py-2 text-[9px] font-medium tracking-widest text-dark uppercase transition-colors duration-200 hover:bg-dark hover:text-white"
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Menu capsule — matches the top toggle's capsule + width */}
        <button
          ref={bottomPillRef}
          onClick={() => setMenuOpen((o) => !o)}
          className={CAPSULE}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <span className="flex flex-col items-center gap-1.5">
            <span
              className={clsx(
                "block h-px w-5 bg-current transition-all duration-300",
                menuOpen && "translate-y-[7px] rotate-45",
              )}
            />
            <span
              className={clsx(
                "block h-px w-5 bg-current transition-opacity duration-300",
                menuOpen && "opacity-0",
              )}
            />
            <span
              className={clsx(
                "block h-px w-5 bg-current transition-all duration-300",
                menuOpen && "-translate-y-[7px] -rotate-45",
              )}
            />
          </span>
          <span>menu</span>
        </button>
      </div>
    </>
  )
}
