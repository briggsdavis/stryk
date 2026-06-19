import { Component, type ErrorInfo, type ReactNode } from "react"

interface ErrorBoundaryProps {
  children: ReactNode
  // Rendered in place of the children when they throw. Defaults to nothing,
  // so a failing non-critical widget simply disappears instead of taking the
  // whole page down with it.
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

// Stops an error in one subtree (e.g. a marketing widget whose Convex query
// isn't available) from unmounting the entire React tree and blanking the site.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, info)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null
    }
    return this.props.children
  }
}
