import { useTransitionNavigate } from "../../lib/transition"
import { HoverLabel } from "./hover-label"

const NAV_LINKS = [
  { label: "Collections", to: "/" },
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
]

export function Footer() {
  const navigate = useTransitionNavigate()

  return (
    <footer className="border-t border-dark/10 px-6 py-12 md:px-10">
      <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
        {/* Brand + nav */}
        <div className="flex flex-col gap-6">
          <span className="text-xs font-medium tracking-[0.2em] text-dark/50 uppercase">Stryk</span>
          <nav className="flex gap-6">
            {NAV_LINKS.map(({ label, to }) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                className="group text-xs tracking-widest text-dark/40 uppercase transition-colors hover:text-dark"
              >
                <HoverLabel>{label}</HoverLabel>
              </button>
            ))}
          </nav>
        </div>

        {/* Right - copyright + credit */}
        <div className="flex flex-col items-start gap-1.5 md:items-end">
          <span className="text-xs text-dark/30">© {new Date().getFullYear()} Stryk</span>
          <a
            href="https://socialsatisfaction.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-dark/25 transition-colors hover:text-dark/50"
          >
            Made by Social Satisfaction
          </a>
        </div>
      </div>
    </footer>
  )
}
