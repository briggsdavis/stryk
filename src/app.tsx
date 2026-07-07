import { lazy, Suspense } from "react"
import { Route, BrowserRouter as Router, Routes } from "react-router"
import { AnalyticsTracker } from "./components/analytics-tracker"
import { PublicMarketing } from "./components/marketing/public-marketing"
import { CustomCursor } from "./components/ui/custom-cursor"
import { ErrorBoundary } from "./components/ui/error-boundary"
import { ArtworkFocusProvider } from "./lib/artwork-focus"
import { TransitionProvider } from "./lib/transition"
import { AboutPage } from "./pages/about/index"
import { CollectionPage } from "./pages/collection/index"
import { CollectionsPage } from "./pages/collections/index"
import { ContactPage } from "./pages/contact/index"
import { HomePage } from "./pages/home/index"

// The admin dashboard (charts, analytics ranges, and its own heavy deps) is
// behind auth and never needed by public visitors, so keep it out of the main
// bundle that gates first paint — load it on demand when /admin is opened.
const AdminPage = lazy(() => import("./pages/admin/index").then((m) => ({ default: m.AdminPage })))

export default function App() {
  return (
    <Router>
      <TransitionProvider>
        <CustomCursor />
        <AnalyticsTracker />
        {/* Marketing is non-critical: never let a failure here blank the site. */}
        <ErrorBoundary>
          <PublicMarketing />
        </ErrorBoundary>
        <ArtworkFocusProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route
              path="/admin"
              element={
                <Suspense fallback={null}>
                  <AdminPage />
                </Suspense>
              }
            />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/collections" element={<CollectionsPage />} />
            <Route path="/collection/:slug" element={<CollectionPage />} />
          </Routes>
        </ArtworkFocusProvider>
      </TransitionProvider>
    </Router>
  )
}
