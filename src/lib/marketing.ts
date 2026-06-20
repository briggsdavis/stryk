// Shared popup vocabulary used by the admin editor and the public renderer.

export type PopupPosition =
  | "center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "top"
  | "bottom"
  | "left"
  | "right"

export type PopupFrequency = "everyVisit" | "oncePerSession" | "oncePerDay"

export type PopupMediaType = "image" | "video"

// A pop-up is triggered EITHER by time-on-page (with page targeting) OR by a
// user action. The two are mutually exclusive — see POPUP_TRIGGER_OPTIONS.
export type PopupTriggerType = "time" | "action"

// Pages a time-triggered pop-up can be targeted to.
export type PopupPage = "home" | "about" | "contact" | "collection"

// User actions that can trigger an action-triggered pop-up. These fire on the
// home canvas and collection pages where the matching interaction lives.
export type PopupAction = "filter" | "product" | "collection"

export const POPUP_TRIGGER_OPTIONS: Array<{ value: PopupTriggerType; label: string }> = [
  { value: "time", label: "Time on page" },
  { value: "action", label: "User action" },
]

export const POPUP_PAGE_OPTIONS: Array<{ value: PopupPage; label: string }> = [
  { value: "home", label: "Home" },
  { value: "about", label: "About" },
  { value: "contact", label: "Contact" },
  { value: "collection", label: "Collection pages" },
]

export const POPUP_ACTION_OPTIONS: Array<{ value: PopupAction; label: string }> = [
  { value: "filter", label: "When a filter is clicked" },
  { value: "product", label: "When a product is opened" },
  { value: "collection", label: "When a collection is opened" },
]

// Map the current pathname to a page key for time-triggered targeting.
export function pageFromPath(pathname: string): PopupPage | null {
  if (pathname === "/") return "home"
  if (pathname === "/about") return "about"
  if (pathname === "/contact") return "contact"
  if (pathname.startsWith("/collection/")) return "collection"
  return null
}

// Lightweight global bus so interaction sites (filter pills, product/collection
// open) can fire action triggers without threading props down to the marketing
// renderer mounted at the app root.
const POPUP_ACTION_EVENT = "stryk:popup-action"

export function emitPopupAction(action: PopupAction): void {
  window.dispatchEvent(new CustomEvent(POPUP_ACTION_EVENT, { detail: action }))
}

export function onPopupAction(handler: (action: PopupAction) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<PopupAction>).detail)
  window.addEventListener(POPUP_ACTION_EVENT, listener)
  return () => window.removeEventListener(POPUP_ACTION_EVENT, listener)
}

export const POPUP_POSITION_OPTIONS: Array<{ value: PopupPosition; label: string }> = [
  { value: "center", label: "Center (modal)" },
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "top", label: "Top edge" },
  { value: "bottom", label: "Bottom edge" },
  { value: "left", label: "Left edge" },
  { value: "right", label: "Right edge" },
]

export const POPUP_FREQUENCY_OPTIONS: Array<{ value: PopupFrequency; label: string }> = [
  { value: "everyVisit", label: "Every visit" },
  { value: "oncePerSession", label: "Once per session" },
  { value: "oncePerDay", label: "Once per day" },
]

export const MAX_POPUP_MEDIA = 5

// "center" is a true modal; everything else is a less-intrusive slide-in card.
export function isModalPosition(position: PopupPosition): boolean {
  return position === "center"
}
