import { clsx } from "clsx"
import { type ReactNode, useLayoutEffect, useRef } from "react"
import { useIsMobile } from "../../hooks/use-is-mobile"
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
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true" fill="none">
      <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="1.5" />
      <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

// A bottom-bar control whose trigger morphs from a labelled capsule into a round
// "X". On desktop the items slide out horizontally alongside it; on mobile the
// horizontal track would run off-screen, so the items instead stack vertically
// above the trigger and morph in with a staggered pop.
export function ExpandingControl({
  open,
  onToggle,
  icon,
  label,
  ariaLabel,
  children,
  dimmed,
}: ExpandingControlProps) {
  const isMobile = useIsMobile()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const trackInnerRef = useRef<HTMLDivElement>(null)
  const columnRef = useRef<HTMLDivElement>(null)
  const prevTriggerWidthRef = useRef<number | null>(null)
  const firstRunRef = useRef(true)

  // ── Desktop: horizontal glide ─────────────────────────────────────────────
  useLayoutEffect(() => {
    if (isMobile) return
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

    const items = gsap.utils.toArray<HTMLElement>(inner.children)
    if (open) {
      // The centred bar re-centres (the trigger + items glide left) the whole
      // time the track widens. The bar's width is trigger.width + track.width, so
      // the trigger and track MUST share the same ease + duration - otherwise the
      // two curves fight and the trigger lurches sideways (the "teleport").
      // Open the track first, let that glide finish, then pop the items in at
      // their final resting spot so there's no trailing shift. Items stay
      // invisible while widening, so nothing is clipped and the fade isn't masked.
      gsap.killTweensOf([trigger, track, ...items])
      gsap.set(items, { opacity: 0, y: 10, scale: 0.9 })
      // Keep overflow hidden WHILE widening. A flex item with `overflow: visible`
      // has `min-width: auto` (= its content width), which would force the track
      // to full width in a single frame - jumping the bar and teleporting the
      // trigger. Hidden makes min-width resolve to 0, so the width tween actually
      // drives the glide. Switch to visible only once it's already content-sized.
      track.style.overflow = "hidden"
      gsap.fromTo(
        trigger,
        { width: prev },
        { width: triggerTarget, duration: 0.55, ease: "power2.inOut" },
      )
      gsap.fromTo(
        track,
        { width: 0 },
        {
          width: innerWidth,
          duration: 0.55,
          ease: "power2.inOut",
          onComplete: () => {
            // Settle to auto + visible (no jump: already at content width) so the
            // popovers can overflow and later content changes (badges/clear) reflow.
            track.style.width = "auto"
            track.style.overflow = "visible"
            gsap.to(items, {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.5,
              stagger: 0.08,
              ease: "power3.out",
            })
          },
        },
      )
    } else {
      // Clip while collapsing so the fading items don't spill past the shrinking
      // track. Trigger + track share the same ease/duration here too.
      track.style.overflow = "hidden"
      gsap.killTweensOf([trigger, track, ...items])
      gsap.to(items, { opacity: 0, y: 8, scale: 0.9, duration: 0.2, ease: "power2.in" })
      gsap.fromTo(
        trigger,
        { width: prev },
        { width: triggerTarget, duration: 0.5, ease: "expo.out" },
      )
      gsap.fromTo(track, { width: innerWidth }, { width: 0, duration: 0.5, ease: "expo.out" })
    }
  }, [open, isMobile])

  // ── Mobile: vertical stack above the trigger ──────────────────────────────
  useLayoutEffect(() => {
    if (!isMobile) return
    const trigger = triggerRef.current
    const column = columnRef.current
    if (!column) return

    // Morph the trigger into a 42px circle when open, back to its labelled width
    // when closed (measured with width:auto, the way the desktop path does it).
    if (trigger) {
      gsap.killTweensOf(trigger)
      if (firstRunRef.current) {
        trigger.style.width = open ? "42px" : "auto"
      } else if (open) {
        gsap.to(trigger, { width: 42, duration: 0.45, ease: "power2.inOut" })
      } else {
        trigger.style.width = "auto"
        const natural = Math.ceil(trigger.getBoundingClientRect().width)
        gsap.fromTo(
          trigger,
          { width: 42 },
          {
            width: natural,
            duration: 0.45,
            ease: "power2.inOut",
            onComplete: () => {
              if (triggerRef.current) triggerRef.current.style.width = "auto"
            },
          },
        )
      }
    }

    // Some children (e.g. <FilterPills>) render a `display:contents` wrapper that
    // has no box to animate; step into it so the real pills are the stack items.
    const items = (Array.from(column.children) as HTMLElement[]).flatMap((el) =>
      getComputedStyle(el).display === "contents"
        ? (Array.from(el.children) as HTMLElement[])
        : [el],
    )
    gsap.killTweensOf(items)

    if (firstRunRef.current) {
      firstRunRef.current = false
      gsap.set(items, { opacity: open ? 1 : 0, y: open ? 0 : 12, scale: open ? 1 : 0.9 })
      return
    }

    if (open) {
      gsap.fromTo(
        items,
        { opacity: 0, y: 14, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.06, ease: "back.out(1.4)" },
      )
    } else {
      gsap.to(items, {
        opacity: 0,
        y: 12,
        scale: 0.9,
        duration: 0.25,
        stagger: 0.04,
        ease: "power2.in",
      })
    }
  }, [open, isMobile])

  return (
    <div
      className={clsx(
        "relative flex items-center transition-opacity duration-300",
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
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
              {icon}
            </span>
            <HoverLabel>{label}</HoverLabel>
          </>
        )}
      </button>

      {/* Desktop items track - width-animated so the centred bar re-centres
          smoothly. The inner is w-max (content-sized) so it isn't squeezed to the
          track's collapsed width; otherwise its measured width is 0 and the open
          tween animates 0→0 while the real growth snaps in at the end (a teleport). */}
      {!isMobile && (
        <div ref={trackRef} style={{ width: 0, overflow: "hidden" }}>
          <div ref={trackInnerRef} className="flex w-max items-center gap-2 pl-2">
            {children}
          </div>
        </div>
      )}

      {/* Mobile stack - the options rise vertically out of the trigger, nearest
          item closest to the button. Anchored above so nothing runs off-screen. */}
      {isMobile && (
        <div
          ref={columnRef}
          className="absolute bottom-full left-1/2 mb-3 flex w-max -translate-x-1/2 flex-col-reverse items-center gap-2"
          style={{ pointerEvents: open ? "auto" : "none" }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
