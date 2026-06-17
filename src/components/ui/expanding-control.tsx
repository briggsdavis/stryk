import { clsx } from "clsx"
import { type ReactNode, useLayoutEffect, useRef } from "react"
import { gsap } from "../../lib/gsap"
import { HoverLabel } from "./hover-label"

interface ExpandingControlProps {
  open: boolean
  onToggle: () => void
  icon: ReactNode
  label: string
  ariaLabel: string
  children: ReactNode
  // Fade the whole control out (e.g. the filter while the menu is open).
  dimmed?: boolean
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none">
      <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="1.5" />
      <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

// A bottom-bar control whose trigger morphs from a labelled capsule into a round
// "X" while its items slide out alongside it. Animating the trigger width and the
// items-track width together makes the centred bar re-centre smoothly, so the
// trigger visibly glides aside to make room for the emerging buttons.
export function ExpandingControl({
  open,
  onToggle,
  icon,
  label,
  ariaLabel,
  children,
  dimmed,
}: ExpandingControlProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const trackInnerRef = useRef<HTMLDivElement>(null)
  const prevTriggerWidthRef = useRef<number | null>(null)
  const firstRunRef = useRef(true)

  useLayoutEffect(() => {
    const trigger = triggerRef.current
    const track = trackRef.current
    const inner = trackInnerRef.current
    if (!trigger || !track || !inner) return

    // Target trigger width: a fixed 42px circle when open, else its natural
    // labelled width.
    trigger.style.width = "auto"
    const triggerTarget = open ? 42 : Math.ceil(trigger.getBoundingClientRect().width)
    const innerWidth = Math.ceil(inner.getBoundingClientRect().width)
    const prev = prevTriggerWidthRef.current
    prevTriggerWidthRef.current = triggerTarget

    if (firstRunRef.current || prev == null) {
      firstRunRef.current = false
      trigger.style.width = `${triggerTarget}px`
      // Open: let the track size to content (so popovers/badges aren't clipped).
      track.style.overflow = open ? "visible" : "hidden"
      track.style.width = open ? "auto" : "0px"
      return
    }

    gsap.fromTo(trigger, { width: prev }, { width: triggerTarget, duration: 0.5, ease: "expo.out" })

    const items = inner.querySelectorAll<HTMLElement>(":scope > *")
    if (open) {
      // Grow from 0 to the content width, then release to `auto`/`visible` so the
      // upward popovers and later badge/clear changes aren't clipped.
      track.style.overflow = "hidden"
      gsap.fromTo(
        track,
        { width: 0 },
        {
          width: innerWidth,
          duration: 0.5,
          ease: "expo.out",
          onComplete: () => {
            track.style.width = "auto"
            track.style.overflow = "visible"
          },
        },
      )
      gsap.fromTo(
        items,
        { opacity: 0, x: -14 },
        { opacity: 1, x: 0, duration: 0.4, stagger: 0.05, ease: "power3.out", delay: 0.08 },
      )
    } else {
      // Pin the current width, hide overflow, then collapse to 0.
      track.style.overflow = "hidden"
      gsap.fromTo(track, { width: innerWidth }, { width: 0, duration: 0.5, ease: "expo.out" })
      gsap.to(items, { opacity: 0, x: -10, duration: 0.2, ease: "power2.in" })
    }
  }, [open])

  return (
    <div
      className={clsx(
        "flex items-center transition-opacity duration-300",
        dimmed && "pointer-events-none opacity-0",
      )}
    >
      <button
        ref={triggerRef}
        onClick={onToggle}
        aria-label={ariaLabel}
        aria-expanded={open}
        className={clsx(
          "group flex h-[42px] shrink-0 items-center justify-center gap-2.5 overflow-hidden border border-dark/15 bg-canvas text-sm font-medium whitespace-nowrap text-dark transition-[background-color,border-color,border-radius,color] duration-300 hover:border-dark/40 hover:bg-dark hover:text-white",
          open ? "rounded-full px-0" : "rounded-lg px-4",
        )}
      >
        {open ? (
          <XIcon />
        ) : (
          <>
            <span className="flex shrink-0 items-center transition-transform duration-300 group-hover:-translate-x-0.5">
              {icon}
            </span>
            <HoverLabel>{label}</HoverLabel>
          </>
        )}
      </button>

      {/* Items track — width-animated so the centred bar re-centres smoothly */}
      <div ref={trackRef} style={{ width: 0, overflow: "hidden" }}>
        <div ref={trackInnerRef} className="flex items-center gap-2 pl-2">
          {children}
        </div>
      </div>
    </div>
  )
}
