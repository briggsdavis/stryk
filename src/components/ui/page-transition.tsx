import { forwardRef } from "react"

export const PageTransition = forwardRef<HTMLDivElement>(function PageTransition(_, ref) {
  return (
    <div ref={ref} className="page-transition">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="page-transition-col" />
      ))}
    </div>
  )
})
