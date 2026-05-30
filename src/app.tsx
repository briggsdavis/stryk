import { Route, BrowserRouter as Router, Routes } from "react-router"
import { CustomCursor } from "./components/ui/custom-cursor"
import { AboutPage } from "./pages/about/index"
import { ContactPage } from "./pages/contact/index"
import { HomePage } from "./pages/home/index"

export default function App() {
  return (
    <Router>
      <CustomCursor />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
      </Routes>
    </Router>
  )
}
