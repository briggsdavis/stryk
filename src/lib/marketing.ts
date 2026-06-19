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
