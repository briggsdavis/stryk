import { createContext, useCallback, useContext, useRef } from "react"
import { flushSync } from "react-dom"
import { useNavigate, useLocation } from "react-router"
import type { ReactNode } from "react"

const TransitionCtx = createContext<(to: string) => void>(() => {})
export const useTransitionNavigate = () => useContext(TransitionCtx)

type WithVTA = Document & { startViewTransition: (cb: () => void) => { finished: Promise<void> } }

export function TransitionProvider({ children }: { children: ReactNode }) {
  const navigateFn = useNavigate()
  const { pathname } = useLocation()
  const busyRef = useRef(false)

  const navigate = useCallback(
    (to: string) => {
      if (busyRef.current || to === pathname) return
      busyRef.current = true

      if ("startViewTransition" in document) {
        const vta = (document as WithVTA).startViewTransition(() => {
          flushSync(() => {
            navigateFn(to)
          })
          window.scrollTo(0, 0)
        })
        vta.finished.finally(() => {
          busyRef.current = false
        })
      } else {
        navigateFn(to)
        window.scrollTo(0, 0)
        busyRef.current = false
      }
    },
    [navigateFn, pathname],
  )

  return <TransitionCtx.Provider value={navigate}>{children}</TransitionCtx.Provider>
}
