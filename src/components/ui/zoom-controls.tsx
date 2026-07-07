import { clsx } from "clsx"
import type { ZoomLevel } from "../../lib/types"

interface ZoomControlsProps {
  level: ZoomLevel
  onZoomIn: () => void
  onZoomOut: () => void
}

export function ZoomControls({ level, onZoomIn, onZoomOut }: ZoomControlsProps) {
  return (
    // On mobile the menu/filter/cart bar sits centred at the bottom, so lift the
    // zoom controls clear of it; on desktop they stay in the bottom-right corner.
    <div className="fixed right-6 bottom-28 z-[200] flex flex-col items-center gap-2 md:right-8 md:bottom-8">
      <div className="flex flex-row items-center gap-1">
        <button
          onClick={onZoomOut}
          disabled={level <= 0}
          className={clsx(
            "flex h-9 w-9 items-center justify-center rounded-lg border text-base font-light transition-all duration-300",
            level <= 0
              ? "border-dark/10 text-dark/20"
              : "border-dark/20 text-dark hover:border-dark hover:bg-dark hover:text-white",
          )}
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          onClick={onZoomIn}
          disabled={level >= 2}
          className={clsx(
            "flex h-9 w-9 items-center justify-center rounded-lg border text-base font-light transition-all duration-300",
            level >= 2
              ? "border-dark/10 text-dark/20"
              : "border-dark/20 text-dark hover:border-dark hover:bg-dark hover:text-white",
          )}
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
      <div className="flex flex-row items-center gap-1">
        {([0, 1, 2] as ZoomLevel[]).map((z) => (
          <div
            key={z}
            className={clsx(
              "rounded-full transition-all duration-300",
              z === level ? "h-2 w-2 bg-dark" : "h-1.5 w-1.5 bg-dark/20",
            )}
          />
        ))}
      </div>
    </div>
  )
}
