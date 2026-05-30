import { clsx } from "clsx"
import type { ZoomLevel } from "../../lib/types"

interface ZoomControlsProps {
  level: ZoomLevel
  onZoomIn: () => void
  onZoomOut: () => void
}

export function ZoomControls({ level, onZoomIn, onZoomOut }: ZoomControlsProps) {
  return (
    <div className="fixed right-8 bottom-8 z-[200] flex flex-col gap-1">
      <button
        onClick={onZoomIn}
        disabled={level >= 2}
        className={clsx(
          "flex h-9 w-9 items-center justify-center rounded-lg border text-base font-light transition-all duration-300",
          level >= 2
            ? "cursor-not-allowed border-dark/10 text-dark/20"
            : "border-dark/20 text-dark hover:border-dark hover:bg-dark hover:text-white",
        )}
        aria-label="Zoom in"
      >
        +
      </button>
      <button
        onClick={onZoomOut}
        disabled={level <= 1}
        className={clsx(
          "flex h-9 w-9 items-center justify-center rounded-lg border text-base font-light transition-all duration-300",
          level <= 1
            ? "cursor-not-allowed border-dark/10 text-dark/20"
            : "border-dark/20 text-dark hover:border-dark hover:bg-dark hover:text-white",
        )}
        aria-label="Zoom out"
      >
        −
      </button>
      <div className="mt-1.5 flex flex-col items-center gap-1">
        {([2, 1] as ZoomLevel[]).map((z) => (
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
