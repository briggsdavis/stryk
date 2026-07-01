import { clsx } from "clsx"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { ActiveFilters, FilterGroup, FilterKey } from "../../lib/filters"
import { activeFilterCount } from "../../lib/filters"
import { gsap } from "../../lib/gsap"
import { HoverLabel } from "./hover-label"

interface FilterPillsProps {
  groups: FilterGroup[]
  active: ActiveFilters
  onToggleOption: (key: FilterKey, value: string) => void
  onClear: () => void
  // Which side the options popover opens toward.
  popoverSide?: "top" | "bottom"
}

function FilterGroupPill({
  group,
  active,
  open,
  side,
  onToggle,
  onToggleOption,
}: {
  group: FilterGroup
  active: string[]
  open: boolean
  side: "top" | "bottom"
  onToggle: () => void
  onToggleOption: (value: string) => void
}) {
  const count = active.length
  const primarySelection = group.options.find((option) => option.value === active[0])
  const buttonLabel = primarySelection?.label ?? group.label
  const extraCount = count > 1 ? count - 1 : 0
  const popoverRef = useRef<HTMLDivElement>(null)

  // Animate the options panel in: the panel grows from the pill while the
  // options fade + slide up in a stagger.
  useLayoutEffect(() => {
    if (!open) return
    const el = popoverRef.current
    if (!el) return
    const dir = side === "top" ? 1 : -1
    gsap.fromTo(
      el,
      { opacity: 0, scale: 0.94, y: dir * 6 },
      { opacity: 1, scale: 1, y: 0, duration: 0.32, ease: "power3.out" },
    )
    gsap.fromTo(
      el.querySelectorAll<HTMLElement>(":scope > button"),
      { opacity: 0, y: dir * 8 },
      { opacity: 1, y: 0, duration: 0.3, stagger: 0.035, ease: "power3.out", delay: 0.05 },
    )
  }, [open, side])

  return (
    <div className="relative">
      {open && (
        <div
          ref={popoverRef}
          style={{ transformOrigin: side === "top" ? "bottom center" : "top center" }}
          className={clsx(
            "absolute left-0 z-10 flex min-w-[150px] flex-col gap-1 rounded-xl border border-dark/15 bg-canvas p-1.5 shadow-lg shadow-dark/5",
            side === "top" ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          {group.options.map((opt) => {
            const selected = active.includes(opt.value)
            return (
              <button
                key={opt.value}
                onClick={() => onToggleOption(opt.value)}
                className={clsx(
                  "group flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors",
                  selected ? "bg-dark text-white" : "text-dark hover:bg-dark/5",
                )}
              >
                {opt.swatch && (
                  <span
                    className="block h-3 w-3 shrink-0 rounded-full border border-dark/20"
                    style={{ background: opt.swatch }}
                  />
                )}
                <HoverLabel className="flex-1 justify-items-start">{opt.label}</HoverLabel>
                {selected && <span className="text-[11px]">✓</span>}
              </button>
            )
          })}
        </div>
      )}

      <button
        onClick={onToggle}
        aria-expanded={open}
        className={clsx(
          "group flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-300",
          count > 0
            ? "border-dark bg-dark text-white"
            : "border-dark/15 bg-canvas text-dark hover:border-dark/40",
          )}
      >
        {primarySelection?.swatch && (
          <span
            className="block h-3 w-3 shrink-0 rounded-full border border-white/35"
            style={{ background: primarySelection.swatch }}
          />
        )}
        <HoverLabel>{buttonLabel}</HoverLabel>
        {extraCount > 0 && <span className="text-xs opacity-80">+{extraCount}</span>}
        <span className="text-base leading-none transition-transform duration-300 group-hover:rotate-90">
          {open ? "−" : "+"}
        </span>
      </button>
    </div>
  )
}

export function FilterPills({
  groups,
  active,
  onToggleOption,
  onClear,
  popoverSide = "top",
}: FilterPillsProps) {
  const [openGroup, setOpenGroup] = useState<FilterKey | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const total = activeFilterCount(active)

  useEffect(() => {
    if (!openGroup) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node) || containerRef.current?.contains(target)) return
      setOpenGroup(null)
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [openGroup])

  return (
    <div ref={containerRef} className="contents">
      {groups.map((group) => (
        <FilterGroupPill
          key={group.key}
          group={group}
          active={active[group.key]}
          open={openGroup === group.key}
          side={popoverSide}
          onToggle={() => setOpenGroup((g) => (g === group.key ? null : group.key))}
          onToggleOption={(value) => onToggleOption(group.key, value)}
        />
      ))}
      {total > 0 && (
        <button
          onClick={onClear}
          className="group rounded-lg px-3 py-2.5 text-xs font-medium tracking-wide text-dark/50 uppercase transition-colors hover:text-dark"
        >
          <HoverLabel>Clear</HoverLabel>
        </button>
      )}
    </div>
  )
}
