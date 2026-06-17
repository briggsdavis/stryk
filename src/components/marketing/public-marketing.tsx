import { useMutation, useQuery } from "convex/react"
import { useEffect, useMemo, useState } from "react"
import { Link, useLocation } from "react-router"
import { api } from "../../../convex/_generated/api"
import { HoverLabel } from "../ui/hover-label"

function popupStorageKey(frequency: string) {
  const day = new Date().toISOString().slice(0, 10)
  return frequency === "oncePerDay" ? `stryk-popup:${day}` : "stryk-popup:session"
}

export function PublicMarketing() {
  const location = useLocation()
  const isHome = location.pathname === "/"
  const route = isHome ? "home" : "other"
  const announcement = useQuery(api.marketing.activeAnnouncement, { route })
  const popup = useQuery(api.marketing.getPopup)
  const capturePopupEmail = useMutation(api.inquiries.capturePopupEmail)
  const [popupVisible, setPopupVisible] = useState(false)
  const [email, setEmail] = useState("")
  const [captured, setCaptured] = useState(false)

  const shouldRenderPopup = useMemo(() => {
    if (!isHome || !popup?.isActive) return false
    if (popup.frequency === "everyVisit") return true
    const storage = popup.frequency === "oncePerDay" ? window.localStorage : window.sessionStorage
    return storage.getItem(popupStorageKey(popup.frequency)) !== "seen"
  }, [isHome, popup])

  useEffect(() => {
    setPopupVisible(false)
    setCaptured(false)
    if (!popup || !shouldRenderPopup) return

    const id = window.setTimeout(() => setPopupVisible(true), popup.delaySeconds * 1000)
    return () => window.clearTimeout(id)
  }, [popup, shouldRenderPopup])

  const dismissPopup = () => {
    if (popup && popup.frequency !== "everyVisit") {
      const storage = popup.frequency === "oncePerDay" ? window.localStorage : window.sessionStorage
      storage.setItem(popupStorageKey(popup.frequency), "seen")
    }
    setPopupVisible(false)
  }

  const submitEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email.trim()) return
    await capturePopupEmail({ email, source: "home-popup" })
    setCaptured(true)
    setEmail("")
  }

  return (
    <>
      {announcement && (
        <div
          className="fixed top-0 right-0 left-0 z-[700] flex min-h-11 items-center justify-center gap-4 px-5 py-3 text-center text-sm"
          style={{ backgroundColor: announcement.backgroundColor, color: announcement.textColor }}
        >
          <span>{announcement.text}</span>
          {announcement.buttonLabel && announcement.buttonLink && (
            <Link to={announcement.buttonLink} className="underline underline-offset-4">
              {announcement.buttonLabel}
            </Link>
          )}
        </div>
      )}

      {popup && popupVisible && (
        <div className="fixed inset-0 z-[800] flex items-center justify-center bg-dark/35 px-5 backdrop-blur-sm">
          <section className="relative grid w-full max-w-3xl overflow-hidden rounded-lg bg-canvas shadow-2xl md:grid-cols-[0.9fr_1fr]">
            <button
              type="button"
              onClick={dismissPopup}
              aria-label="Close popup"
              className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-light/85 text-xl leading-none"
            >
              x
            </button>
            {popup.imageUrl ? (
              <img src={popup.imageUrl} alt="" className="h-64 w-full object-cover md:h-full" />
            ) : (
              <div className="h-64 bg-dark/10 md:h-full" />
            )}
            <div className="p-7 md:p-9">
              <h2 className="text-48 mb-4">{popup.heading}</h2>
              <p className="mb-6 text-sm leading-6 text-dark/65">{popup.text}</p>
              {popup.emailCaptureEnabled && (
                <form onSubmit={(event) => void submitEmail(event)} className="mb-5 flex gap-2">
                  <input
                    type="email"
                    aria-label="Email address"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Email address"
                    className="min-w-0 flex-1 rounded-lg border border-dark/15 bg-light/45 px-4 py-3 text-sm outline-none"
                  />
                  <button
                    type="submit"
                    className="group rounded-lg bg-dark px-4 py-3 text-sm text-white"
                  >
                    <HoverLabel>Join</HoverLabel>
                  </button>
                </form>
              )}
              {captured && <p className="mb-5 text-sm text-loam">Thanks, you're on the list.</p>}
              {popup.buttonLabel && popup.buttonLink && (
                <Link
                  to={popup.buttonLink}
                  onClick={dismissPopup}
                  className="group inline-flex rounded-lg border border-dark/20 px-5 py-3 text-sm font-medium transition-colors hover:bg-dark hover:text-white"
                >
                  <HoverLabel>{popup.buttonLabel}</HoverLabel>
                </Link>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
