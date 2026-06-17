import { clsx } from "clsx"
import { useState } from "react"
import type { ActiveFilters, FilterGroup, FilterKey } from "../../lib/filters"
import { activeFilterCount } from "../../lib/filters"

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

  return (
    <div className="relative">
      {open && (
        <div
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
          "group flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-300",
          count > 0
            ? "border-dark bg-dark text-white"
            : "border-dark/15 bg-canvas text-dark hover:border-dark/40",
        )}
      >
        <span>{group.label}</span>
        {count > 0 && <span className="text-xs opacity-80">· {count}</span>}
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
  const total = activeFilterCount(active)

  return (
    <>
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
          className="rounded-lg px-3 py-2.5 text-xs font-medium tracking-wide text-dark/50 uppercase transition-colors hover:text-dark"
        >
          Clear
        </button>
      )}
    </>
  )
}
