import { HoverLabel } from "./hover-label"

interface EmptyFilterStateProps {
  onContact: () => void
  className?: string
}

// Shown when the active filters match no pieces. Invites the visitor to ask for
// the piece they had in mind via the contact form.
export function EmptyFilterState({ onContact, className }: EmptyFilterStateProps) {
  return (
    <div
      className={
        "pointer-events-none flex flex-col items-center px-6 text-center" +
        (className ? ` ${className}` : "")
      }
    >
      <p className="text-128 max-w-[14ch] leading-[0.95] text-dark">
        We don't have anything just like that
      </p>
      <p className="mt-6 max-w-md text-sm leading-relaxed text-dark/60">
        But we'd love to track it down. Tell us what you're after - a colour, a city, a style - and
        we'll search our stock and upcoming sourcing trips for a match.
      </p>
      <button
        onClick={onContact}
        className="group pointer-events-auto mt-8 flex items-center gap-2 rounded-lg bg-dark px-6 py-3 text-sm font-medium text-white transition-colors duration-300 hover:bg-dark/85"
      >
        <HoverLabel>Make a special request</HoverLabel>
        <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
      </button>
    </div>
  )
}
