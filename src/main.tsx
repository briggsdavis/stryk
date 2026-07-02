import { ConvexAuthProvider } from "@convex-dev/auth/react"
import { StrictMode } from "react"
import type { ReactNode } from "react"
import { createRoot } from "react-dom/client"
import App from "./app.tsx"
import { ShopifyCartProvider } from "./hooks/use-shopify-cart.tsx"
import { convex } from "./lib/convex-client.ts"
import "./index.css"

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
