import { createContext, useCallback, useContext, useRef } from "react"
import type { ReactNode } from "react"
import { flushSync } from "react-dom"
import { useNavigate, useLocation } from "react-router"

// A navigation can opt into a named transition `type` (styled via
// `:active-view-transition-type(...)` in index.css). `onNavigate` runs in the
// route-swap flush so overlays can be cleared from the incoming snapshot.
type NavigateOptions = {
  type?: string
  state?: unknown
  onNavigate?: () => void
}
type TransitionApi = {
  navigate: (to: string, options?: NavigateOptions) => void
  back: () => void
}
const TransitionCtx = createContext<TransitionApi>({ navigate: () => {}, back: () => {} })
export const useTransitionNavigate = () => useContext(TransitionCtx).navigate
export const useTransitionBack = () => useContext(TransitionCtx).back

type ViewTransition = { finished: Promise<void> }
type StartViewTransition = (
  cbOrOptions: (() => void) | { update: () => void; types?: string[] },
) => ViewTransition
type WithVTA = Document & { startViewTransition: StartViewTransition }

export function TransitionProvider({ children }: { children: ReactNode }) {
  const navigateFn = useNavigate()
  const { pathname } = useLocation()
  const busyRef = useRef(false)

  const navigate = useCallback(
    (to: string, options?: NavigateOptions) => {
      if (busyRef.current || to === pathname) return
      busyRef.current = true

      const update = () => {
        flushSync(() => {
          navigateFn(to, options?.state === undefined ? undefined : { state: options.state })
          options?.onNavigate?.()
        })
        window.scrollTo(0, 0)
      }

      if ("startViewTransition" in document) {
        const doc = document as WithVTA
        let vta: ViewTransition
        if (options?.type) {
          // The typed (object) form is newer than the plain callback form; where
          // it isn't supported, fall back to a default cross-fade rather than
          // failing the navigation.
          try {
            vta = doc.startViewTransition({ update, types: [options.type] })
          } catch {
            vta = doc.startViewTransition(update)
          }
        } else {
          vta = doc.startViewTransition(update)
        }
        vta.finished.finally(() => {
          busyRef.current = false
        })
      } else {
        update()
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
