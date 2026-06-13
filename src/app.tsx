import { Route, BrowserRouter as Router, Routes } from "react-router"
import { PublicMarketing } from "./components/marketing/public-marketing"
import { CustomCursor } from "./components/ui/custom-cursor"
import { TransitionProvider } from "./lib/transition"
import { AboutPage } from "./pages/about/index"
import { AdminPage } from "./pages/admin/index"
import { ContactPage } from "./pages/contact/index"
import { HomePage } from "./pages/home/index"

export default function App() {
  return (
    <Router>
      <TransitionProvider>
        <CustomCursor />
        <PublicMarketing />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Routes>
      </TransitionProvider>
    </Router>
  )
}
