import { ConvexAuthProvider } from "@convex-dev/auth/react"
import { ConvexReactClient } from "convex/react"
import { StrictMode } from "react"
import type { ReactNode } from "react"
import { createRoot } from "react-dom/client"
import App from "./app.tsx"
import { ShopifyCartProvider } from "./hooks/use-shopify-cart.tsx"
import "./index.css"

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined

// Only initialize the Convex client when a URL is configured. Constructing
// ConvexReactClient with an undefined URL throws synchronously, which would
// blank the entire app (e.g. on a Vercel deploy missing VITE_CONVEX_URL).
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null

function Providers({ children }: { children: ReactNode }) {
  if (convex) {
    return (
      <ConvexAuthProvider client={convex}>
        <ShopifyCartProvider>{children}</ShopifyCartProvider>
      </ConvexAuthProvider>
    )
  }
  return <>{children}</>
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
)
