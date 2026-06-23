import { createContext, useCallback, useContext, useRef } from "react"
import type { ReactNode } from "react"
import { flushSync } from "react-dom"
import { useNavigate, useLocation } from "react-router"

type TransitionApi = { navigate: (to: string) => void; back: () => void }
const TransitionCtx = createContext<TransitionApi>({ navigate: () => {}, back: () => {} })
export const useTransitionNavigate = () => useContext(TransitionCtx).navigate
export const useTransitionBack = () => useContext(TransitionCtx).back

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

  // Go back through history with the same cross-fade. Falls back to the home page
  // when there's no in-app history to return to, so users are never stranded.
  const back = useCallback(() => {
    if (busyRef.current) return
    const go = () => {
      if (window.history.length > 1) navigateFn(-1)
      else navigateFn("/")
    }
    busyRef.current = true

    if ("startViewTransition" in document) {
      const vta = (document as WithVTA).startViewTransition(() => {
        flushSync(go)
      })
      vta.finished.finally(() => {
        busyRef.current = false
      })
    } else {
      go()
      busyRef.current = false
    }
  }, [navigateFn])

  return <TransitionCtx.Provider value={{ navigate, back }}>{children}</TransitionCtx.Provider>
}
