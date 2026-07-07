import { useEffect, useRef, useState } from "react"
import { useLocation } from "react-router"

const INTERACTIVE_SELECTOR = "a, button, [role='button']"
const LABEL_SELECTOR = "[data-cursor-label]"

export function CustomCursor() {
  const { pathname } = useLocation()
  const cursorRef = useRef<HTMLDivElement>(null)
  const visibleRef = useRef(false)
  const [isVisible, setIsVisible] = useState(false)
  const [isInteractive, setIsInteractive] = useState(false)
  const [label, setLabel] = useState("")
  const isAdmin = pathname.startsWith("/admin")

  useEffect(() => {
    if (isAdmin || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      document.body.classList.remove("has-custom-cursor")
      return
    }

    const moveCursor = (event: PointerEvent) => {
      cursorRef.current?.style.setProperty(
        "transform",
        `translate(${event.clientX}px, ${event.clientY}px)`,
      )
      if (!visibleRef.current) {
        visibleRef.current = true
        setIsVisible(true)
      }
    }

    const updateState = (target: EventTarget | null) => {
      const element = target instanceof Element ? target : null
      setLabel(element?.closest<HTMLElement>(LABEL_SELECTOR)?.dataset.cursorLabel ?? "")
      setIsInteractive(!!element?.closest?.(INTERACTIVE_SELECTOR))
    }
    const handlePointerOver = (event: PointerEvent) => updateState(event.target)
    const handlePointerOut = (event: PointerEvent) => updateState(event.relatedTarget)

    document.body.classList.add("has-custom-cursor")
    window.addEventListener("pointermove", moveCursor)
    window.addEventListener("pointerover", handlePointerOver)
    window.addEventListener("pointerout", handlePointerOut)

    return () => {
      document.body.classList.remove("has-custom-cursor")
      window.removeEventListener("pointermove", moveCursor)
      window.removeEventListener("pointerover", handlePointerOver)
      window.removeEventListener("pointerout", handlePointerOut)
      visibleRef.current = false
      setIsVisible(false)
      setIsInteractive(false)
      setLabel("")
    }
  }, [isAdmin])

  if (isAdmin) return null

  return (
    <div
      ref={cursorRef}
      className="custom-cursor"
      data-visible={isVisible ? "true" : "false"}
      data-interactive={isInteractive ? "true" : "false"}
      data-labeled={label ? "true" : "false"}
      aria-hidden="true"
    >
      {label}
    </div>
  )
}
