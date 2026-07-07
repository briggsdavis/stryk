import { useEffect, useRef, useState } from "react"
import { gsap } from "../../lib/gsap"

// Elements that read as clickable - hovering any of them hides the native
// cursor (see index.css) and swells the custom cursor for feedback.
const INTERACTIVE_SELECTOR = "a, button, [role='button'], label, summary, [data-cursor-interactive]"

export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)
  const [label, setLabel] = useState("")
  const [interactive, setInteractive] = useState(false)

  useEffect(() => {
    const cursor = cursorRef.current
    if (!cursor) return

    const xTo = gsap.quickTo(cursor, "x", { duration: 0.225, ease: "power3.out" })
    const yTo = gsap.quickTo(cursor, "y", { duration: 0.225, ease: "power3.out" })

    const onMove = (e: MouseEvent) => {
      xTo(e.clientX)
      yTo(e.clientY)
    }

    // `mouseover` bubbles and fires on every element change, so recomputing here
    // covers entering, leaving, and moving between an element's children.
    const onOver = (e: MouseEvent) => {
      const target = e.target as Element | null
      setInteractive(!!target?.closest?.(INTERACTIVE_SELECTOR))
    }

    const onCanvasHover = (e: Event) => {
      const { name } = (e as CustomEvent<{ name: string }>).detail
      setLabel(name)
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseover", onOver)
    window.addEventListener("canvas-hover", onCanvasHover)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseover", onOver)
      window.removeEventListener("canvas-hover", onCanvasHover)
    }
  }, [])

  // Swell on interactive hover, but not while a canvas label is showing (that
  // state already resizes the cursor into a pill).
  const swelled = interactive && !label

  return (
    <div
      ref={cursorRef}
      className="pointer-events-none fixed top-0 left-0 z-[99999] hidden md:block"
      style={{ transform: "translate(-50%, -50%)" }}
    >
      <div
        style={{
          background: "white",
          border: "1px solid black",
          padding: label ? "5px 10px" : "4px",
          minWidth: label ? undefined : "10px",
          minHeight: label ? undefined : "10px",
          transform: swelled ? "scale(1.6)" : "scale(1)",
          transformOrigin: "center",
          transition: "padding 0.15s ease, min-width 0.15s ease, transform 0.18s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: "9px",
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "black",
            whiteSpace: "nowrap",
            lineHeight: 1,
          }}
        >
          {label}
        </span>
      </div>
    </div>
  )
}
