import { clsx } from "clsx"
import { useMutation, useQuery } from "convex/react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation } from "react-router"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { track } from "../../lib/analytics"
import {
  onPopupAction,
  pageFromPath,
  type PopupAction,
  type PopupPage,
  type PopupPosition,
  type PopupTriggerType,
} from "../../lib/marketing"
import { HoverLabel } from "../ui/hover-label"

type PublicPopup = {
  _id: string
  title: string
  heading: string
  text: string
  buttonLabel: string
  buttonLink: string
  buttonEnabled?: boolean
  emailCaptureEnabled: boolean
  delaySeconds: number
  frequency: string
  position: PopupPosition
  blurBackground: boolean
  media: Array<{ type: "image" | "video"; url: string | null }>
  triggerType?: PopupTriggerType
  pages?: PopupPage[]
  action?: PopupAction
}

function popupStorageKey(id: string, frequency: string) {
  const day = new Date().toISOString().slice(0, 10)
  return frequency === "oncePerDay" ? `stryk-popup:${id}:${day}` : `stryk-popup:${id}:session`
}

export function PublicMarketing() {
  const location = useLocation()
  const isHome = location.pathname === "/"
  const route = isHome ? "home" : "other"
  const page = pageFromPath(location.pathname)
  const announcement = useQuery(api.marketing.activeAnnouncement, { route })
  const popups = useQuery(api.marketing.activePopups) as PublicPopup[] | undefined
  const announcementRef = useRef<HTMLDivElement>(null)
  // Count one impression the first time each announcement bar is shown.
  const trackedAnnouncementRef = useRef<string | null>(null)

  useEffect(() => {
    if (!announcement) return
    if (trackedAnnouncementRef.current === announcement._id) return
    trackedAnnouncementRef.current = announcement._id
    track("announcement_view", { path: announcement._id, label: announcement.title })
  }, [announcement])

  // Pop-ups armed by a user action (filter/product/collection click). Stored by
  // id so each fires independently and its card manages its own dismissal.
  const [armed, setArmed] = useState<Set<string>>(new Set())

  useLayoutEffect(() => {
    const root = document.documentElement
    const bar = announcementRef.current

    if (!announcement || !bar) {
      root.style.removeProperty("--announcement-bar-height")
      return
    }

    const syncHeight = () => {
      root.style.setProperty("--announcement-bar-height", `${bar.offsetHeight}px`)
    }
    syncHeight()

    const resizeObserver = new ResizeObserver(syncHeight)
    resizeObserver.observe(bar)
    window.addEventListener("resize", syncHeight)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", syncHeight)
      root.style.removeProperty("--announcement-bar-height")
    }
  }, [announcement])

  const actionPopups = useMemo(
    () => (popups ?? []).filter((p) => p.triggerType === "action"),
    [popups],
  )

  useEffect(() => {
    if (actionPopups.length === 0) return
    return onPopupAction((action) => {
      setArmed((prev) => {
        const next = new Set(prev)
        for (const popup of actionPopups) {
          if (popup.action === action) next.add(popup._id)
        }
        return next
      })
    })
  }, [actionPopups])

  // Time-triggered pop-ups show on their targeted pages. Legacy rows without a
  // trigger default to time/home so existing pop-ups keep their behaviour.
  const timePopups = (popups ?? []).filter((popup) => {
    if (popup.triggerType === "action") return false
    const pages = popup.pages ?? ["home"]
    return page !== null && pages.includes(page)
  })

  return (
    <>
      {announcement && (
        <div
          ref={announcementRef}
          className="sticky top-0 z-[3000] flex min-h-11 items-center justify-center gap-4 px-5 py-3 text-center text-sm"
          style={{ backgroundColor: announcement.backgroundColor, color: announcement.textColor }}
        >
          <span>{announcement.text}</span>
          {announcement.buttonLabel && announcement.buttonLink && (
            <Link
              to={announcement.buttonLink}
              onClick={() => {
                track("cta_click", { label: `Announcement · ${announcement.buttonLabel}` })
                track("announcement_click", {
                  path: announcement._id,
                  label: announcement.buttonLabel,
                })
              }}
              className="underline underline-offset-4"
            >
              {announcement.buttonLabel}
            </Link>
          )}
        </div>
      )}

      {timePopups.map((popup) => (
        <PopupCard key={popup._id} popup={popup} />
      ))}

      {actionPopups
        .filter((popup) => armed.has(popup._id))
        .map((popup) => (
          <PopupCard key={popup._id} popup={popup} immediate />
        ))}
    </>
  )
}

// Anchor position for the popup wrapper. Center is a true modal; the rest are
// slide-in cards pinned to a corner or edge.
const WRAPPER_ANCHOR: Record<PopupPosition, string> = {
  center: "inset-0 flex items-center justify-center p-5",
  "top-left": "top-4 left-4",
  "top-right": "top-4 right-4",
  "bottom-left": "bottom-4 left-4",
  "bottom-right": "bottom-4 right-4",
  top: "top-4 left-1/2",
  bottom: "bottom-4 left-1/2",
  left: "left-4 top-1/2",
  right: "right-4 top-1/2",
}

// Transform that both centres (where needed) and offsets the card off-screen
// toward its anchoring edge before it slides in.
function cardTransform(position: PopupPosition, entered: boolean): string {
  const cx = position === "top" || position === "bottom" ? "-50%" : "0px"
  const cy = position === "left" || position === "right" ? "-50%" : "0px"
  if (entered || position === "center") return `translate(${cx}, ${cy})`
  let ox = "0px"
  let oy = "0px"
  if (position === "top" || position === "top-left" || position === "top-right") oy = "-130%"
  else if (position === "bottom" || position === "bottom-left" || position === "bottom-right")
    oy = "130%"
  else if (position === "left") ox = "-130%"
  else if (position === "right") ox = "130%"
  return `translate(calc(${cx} + ${ox}), calc(${cy} + ${oy}))`
}

function PopupCard({ popup, immediate = false }: { popup: PublicPopup; immediate?: boolean }) {
  const capturePopupEmail = useMutation(api.inquiries.capturePopupEmail)
  const [visible, setVisible] = useState(false)
  const [entered, setEntered] = useState(false)
  const [email, setEmail] = useState("")
  const [captured, setCaptured] = useState(false)
  // Count one impression the first time this pop-up actually appears.
  const trackedViewRef = useRef(false)

  const isModal = popup.position === "center"

  const shouldRender = useMemo(() => {
    if (popup.frequency === "everyVisit") return true
    const storage = popup.frequency === "oncePerDay" ? window.localStorage : window.sessionStorage
    return storage.getItem(popupStorageKey(popup._id, popup.frequency)) !== "seen"
  }, [popup._id, popup.frequency])

  useEffect(() => {
    if (!shouldRender) return
    // Action-triggered pop-ups appear the moment they're armed; time-triggered
    // ones wait out their configured delay.
    const delay = immediate ? 0 : popup.delaySeconds * 1000
    const showId = window.setTimeout(() => {
      setVisible(true)
      if (!trackedViewRef.current) {
        trackedViewRef.current = true
        track("popup_view", { path: popup._id, label: popup.heading || popup.title })
      }
      // Next frame: flip `entered` so the CSS transition animates the slide-in.
      requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)))
    }, delay)
    return () => window.clearTimeout(showId)
  }, [shouldRender, popup.delaySeconds, popup._id, popup.heading, popup.title, immediate])

  const dismiss = () => {
    if (popup.frequency !== "everyVisit") {
      const storage = popup.frequency === "oncePerDay" ? window.localStorage : window.sessionStorage
      storage.setItem(popupStorageKey(popup._id, popup.frequency), "seen")
    }
    setEntered(false)
    window.setTimeout(() => setVisible(false), 350)
  }

  const submitEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email.trim()) return
    await capturePopupEmail({
      email,
      source: popup.title || "Pop-up",
      popupId: popup._id as Id<"popups">,
    })
    setCaptured(true)
    setEmail("")
  }

  if (!visible) return null

  const content = (
    <div
      className={clsx(
        "flex flex-col items-center justify-center text-center",
        isModal ? "p-10 md:p-16" : "p-7",
      )}
    >
      {popup.heading && (
        <h2 className={clsx("mb-4", isModal ? "text-48" : "text-2xl")}>{popup.heading}</h2>
      )}
      {popup.text && <p className="mb-7 max-w-xs text-sm leading-6 text-dark/65">{popup.text}</p>}
      {popup.emailCaptureEnabled && (
        <form
          onSubmit={(event) => void submitEmail(event)}
          className="mb-4 flex w-full max-w-xs flex-col items-center gap-2"
        >
          <input
            type="email"
            aria-label="Email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email address"
            className="w-full rounded-lg border border-dark/15 bg-light/45 px-4 py-3 text-center text-sm outline-none"
          />
          <button
            type="submit"
            className="group w-full rounded-lg bg-dark px-4 py-3 text-sm text-white"
          >
            <HoverLabel>Sign up</HoverLabel>
          </button>
        </form>
      )}
      {captured && <p className="mb-4 text-sm text-loam">Thanks, you're on the list.</p>}
      {/* Legacy rows have no buttonEnabled flag - keep their old behaviour
          (shown whenever a label + link exist). */}
      {(popup.buttonEnabled ?? true) && popup.buttonLabel && popup.buttonLink && (
        <Link
          to={popup.buttonLink}
          onClick={() => {
            track("cta_click", { label: `Pop-up · ${popup.buttonLabel}` })
            track("popup_click", { path: popup._id, label: popup.buttonLabel })
            dismiss()
          }}
          className="group inline-flex rounded-lg border border-dark/20 px-5 py-3 text-sm font-medium transition-colors hover:bg-dark hover:text-white"
        >
          <HoverLabel>{popup.buttonLabel}</HoverLabel>
        </Link>
      )}
    </div>
  )

  const media = popup.media.length > 0 && (
    <Carousel media={popup.media} className={isModal ? "min-h-[22rem] md:h-full" : "h-44"} />
  )

  return (
    <>
      {popup.blurBackground && (
        <button
          type="button"
          aria-label="Close pop-up"
          onClick={dismiss}
          className="fixed inset-0 z-[2090] cursor-default bg-dark/35 backdrop-blur-sm"
        />
      )}
      <div
        className={clsx(
          "fixed z-[2100]",
          WRAPPER_ANCHOR[popup.position],
          !popup.blurBackground && "pointer-events-none",
        )}
      >
        <section
          style={
            isModal
              ? { opacity: entered ? 1 : 0, transform: entered ? "scale(1)" : "scale(0.96)" }
              : { transform: cardTransform(popup.position, entered) }
          }
          className={clsx(
            "pointer-events-auto relative overflow-hidden rounded-lg bg-canvas shadow-2xl transition-all duration-500 [transition-timing-function:var(--ease-ui)]",
            isModal
              ? "grid w-full max-w-5xl md:grid-cols-[1fr_1fr]"
              : "flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col",
          )}
        >
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close popup"
            className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-light/85 text-xl leading-none"
          >
            ×
          </button>
          {media}
          {content}
        </section>
      </div>
    </>
  )
}

function Carousel({ media, className }: { media: PublicPopup["media"]; className?: string }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (media.length <= 1) return
    const id = window.setInterval(() => setIndex((p) => (p + 1) % media.length), 4500)
    return () => window.clearInterval(id)
  }, [media.length])

  const item = media[Math.min(index, media.length - 1)]
  if (!item) return null

  return (
    <div className={clsx("relative w-full overflow-hidden bg-dark/10", className)}>
      {item.type === "video" ? (
        <video
          key={item.url ?? index}
          src={item.url ?? undefined}
          aria-label="Pop-up video"
          className="h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        <img src={item.url ?? undefined} alt="" className="h-full w-full object-cover" />
      )}

      {media.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => setIndex((p) => (p - 1 + media.length) % media.length)}
            className="absolute top-1/2 left-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-canvas/80 text-sm"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => setIndex((p) => (p + 1) % media.length)}
            className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-canvas/80 text-sm"
          >
            ›
          </button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
            {media.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={clsx(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  i === index ? "bg-dark" : "bg-dark/30",
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
