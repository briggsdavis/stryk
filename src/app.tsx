import { Route, BrowserRouter as Router, Routes } from "react-router"
import { PublicMarketing } from "./components/marketing/public-marketing"
import { CustomCursor } from "./components/ui/custom-cursor"
import { ErrorBoundary } from "./components/ui/error-boundary"
import { TransitionProvider } from "./lib/transition"
import { AboutPage } from "./pages/about/index"
import { AdminPage } from "./pages/admin/index"
import { CollectionPage } from "./pages/collection/index"
import { CollectionsPage } from "./pages/collections/index"
import { ContactPage } from "./pages/contact/index"
import { HomePage } from "./pages/home/index"

export default function App() {
  return (
    <Router>
      <TransitionProvider>
        <CustomCursor />
        {/* Marketing is non-critical: never let a failure here blank the site. */}
        <ErrorBoundary>
          <PublicMarketing />
        </ErrorBoundary>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/collection/:slug" element={<CollectionPage />} />
        </Routes>
      </TransitionProvider>
    </Router>
  )
}
