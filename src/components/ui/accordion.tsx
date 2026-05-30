import { clsx } from "clsx"
import { useState } from "react"

interface AccordionItem {
  question: string
  answer: string
}

interface AccordionProps {
  items: AccordionItem[]
  className?: string
}

export function Accordion({ items, className }: AccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className={clsx("divide-y divide-light/10", className)}>
      {items.map((item, i) => {
        const isOpen = openIndex === i
        return (
          <div key={i} className="py-5">
            <button
              className="flex w-full items-center justify-between gap-4 text-left"
              onClick={() => setOpenIndex(isOpen ? null : i)}
            >
              <span className="text-18 font-medium">{item.question}</span>
              <span
                className="flex-shrink-0 text-xl leading-none text-grey transition-transform duration-500"
                style={{
                  transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                  transitionTimingFunction: "var(--ease-ui)",
                }}
              >
                +
              </span>
            </button>
            <div className={clsx("accordion-content", isOpen && "open")}>
              <div>
                <p className="text-18 pt-4 text-light/60">{item.answer}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
