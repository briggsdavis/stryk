import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { useTransitionNavigate } from "../../lib/transition"
import { HoverLabel } from "./hover-label"

const NAV_LINKS = [
  { label: "Collections", to: "/" },
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
]

export function Footer() {
  const navigate = useTransitionNavigate()
  const globalContent = useQuery(api.pages.getGlobal)

  if (globalContent === undefined) return null

  return (
    <footer className="border-t border-dark/10 px-6 py-12 md:px-10">
      <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
        {/* Navigation */}
        <div className="flex flex-col gap-6">
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
          <div className="flex flex-col items-start gap-1.5 text-xs text-dark/40">
            <a href={`mailto:${globalContent.email}`} className="transition-colors hover:text-dark">
              {globalContent.email}
            </a>
            <a
              href={`tel:${globalContent.phone.replace(/[^+\d]/g, "")}`}
              className="transition-colors hover:text-dark"
            >
              {globalContent.phone}
            </a>
          </div>
        </div>

        {/* Right - logo + copyright + credit */}
        <div className="flex flex-col items-start gap-1.5 md:items-end">
          <img
            src="/stryk-logo-128.png"
            alt=""
            aria-hidden="true"
            width={32}
            height={32}
            className="h-8 w-auto opacity-80"
          />
          <span className="text-xs text-dark/30">© {new Date().getFullYear()} Stryk Studios</span>
          <a
            href="https://socialsatisfaction.com"
            target="_blank"
            rel="noopener noreferrer"
            className="group text-xs text-dark/25 transition-colors hover:text-dark/50"
          >
            <HoverLabel>Made by Social Satisfaction</HoverLabel>
          </a>
        </div>
      </div>
    </footer>
  )
}
