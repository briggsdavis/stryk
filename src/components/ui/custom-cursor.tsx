import { useEffect, useRef, useState } from "react"
import { gsap } from "../../lib/gsap"

export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)
  const [label, setLabel] = useState("")

  useEffect(() => {
    const cursor = cursorRef.current
    if (!cursor) return

    const xTo = gsap.quickTo(cursor, "x", { duration: 0.225, ease: "power3.out" })
    const yTo = gsap.quickTo(cursor, "y", { duration: 0.225, ease: "power3.out" })

    const onMove = (e: MouseEvent) => {
      xTo(e.clientX)
      yTo(e.clientY)
    }

    const onCanvasHover = (e: Event) => {
      const { name } = (e as CustomEvent<{ name: string }>).detail
      setLabel(name)
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("canvas-hover", onCanvasHover)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("canvas-hover", onCanvasHover)
    }
  }, [])

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
          transition: "padding 0.15s ease, min-width 0.15s ease",
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
