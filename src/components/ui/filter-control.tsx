import { clsx } from "clsx"
import { useState } from "react"
import type { ActiveFilters, FilterGroup, FilterKey } from "../../lib/filters"
import { activeFilterCount } from "../../lib/filters"
import { CAPSULE, ROUND_CLOSE } from "./pill"

interface FilterControlProps {
  open: boolean
  onToggleOpen: () => void
  groups: FilterGroup[]
  active: ActiveFilters
  onToggleOption: (key: FilterKey, value: string) => void
  onClear: () => void
}

function SlidersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true" fill="none">
      <line x1="4" y1="8" x2="20" y2="8" stroke="currentColor" strokeWidth="1.5" />
      <line x1="4" y1="16" x2="20" y2="16" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="8" r="2.6" fill="currentColor" />
      <circle cx="15" cy="16" r="2.6" fill="currentColor" />
    </svg>
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

// A single filter dimension (color / category / collection). The pill toggles a
// popover of selectable options that floats above it.
function FilterGroupPill({
  group,
  active,
  open,
  onToggle,
  onToggleOption,
}: {
  group: FilterGroup
  active: string[]
  open: boolean
  onToggle: () => void
  onToggleOption: (value: string) => void
}) {
  const count = active.length

  return (
    <div className="relative">
      {/* Options popover */}
      {open && (
        <div className="absolute bottom-full left-0 mb-2 flex min-w-[150px] flex-col gap-1 rounded-xl border border-dark/15 bg-canvas p-1.5 shadow-lg shadow-dark/5">
          {group.options.map((opt) => {
            const selected = active.includes(opt.value)
            return (
              <button
                key={opt.value}
                onClick={() => onToggleOption(opt.value)}
                className={clsx(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors",
                  selected ? "bg-dark text-white" : "text-dark hover:bg-dark/5",
                )}
              >
                {opt.swatch && (
                  <span
                    className="block h-3 w-3 shrink-0 rounded-full border border-dark/20"
                    style={{ background: opt.swatch }}
                  />
                )}
                <span className="flex-1">{opt.label}</span>
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
          "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-300",
          count > 0
            ? "border-dark bg-dark text-white"
            : "border-dark/15 bg-canvas text-dark hover:border-dark/40",
        )}
      >
        <span>{group.label}</span>
        {count > 0 && <span className="text-xs opacity-80">· {count}</span>}
        <span className="text-base leading-none">{open ? "−" : "+"}</span>
      </button>
    </div>
  )
}

export function FilterControl({
  open,
  onToggleOpen,
  groups,
  active,
  onToggleOption,
  onClear,
}: FilterControlProps) {
  const [openGroup, setOpenGroup] = useState<FilterKey | null>(null)
  const total = activeFilterCount(active)

  const handleToggleOpen = () => {
    setOpenGroup(null)
    onToggleOpen()
  }

  if (!open) {
    return (
      <button onClick={handleToggleOpen} className={CAPSULE} aria-label="Open filters">
        <SlidersIcon />
        <span>filter</span>
        {total > 0 && <span className="text-xs opacity-70">· {total}</span>}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={handleToggleOpen} className={ROUND_CLOSE} aria-label="Close filters">
        <XIcon />
      </button>
      {groups.map((group) => (
        <FilterGroupPill
          key={group.key}
          group={group}
          active={active[group.key]}
          open={openGroup === group.key}
          onToggle={() => setOpenGroup((g) => (g === group.key ? null : group.key))}
          onToggleOption={(value) => onToggleOption(group.key, value)}
        />
      ))}
      {total > 0 && (
        <button
          onClick={onClear}
          className="rounded-lg px-3 py-2.5 text-xs font-medium tracking-wide text-dark/50 uppercase transition-colors hover:text-dark"
        >
          Clear
        </button>
      )}
    </div>
  )
}
