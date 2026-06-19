import { Component, type ErrorInfo, type ReactNode } from "react"

interface ErrorBoundaryProps {
  children: ReactNode
  // Rendered in place of the children when they throw. May be a node, or a
  // function that receives the caught error (useful for surfacing the message
  // in admin tooling). Defaults to nothing, so a failing non-critical widget
  // simply disappears instead of taking the whole page down with it.
  fallback?: ReactNode | ((error: Error) => ReactNode)
}

interface ErrorBoundaryState {
  error: Error | null
}

// Stops an error in one subtree (e.g. a marketing widget whose Convex query
// isn't available) from unmounting the entire React tree and blanking the site.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, info)
  }

  render() {
    if (this.state.error) {
      const { fallback } = this.props
      return typeof fallback === "function" ? fallback(this.state.error) : (fallback ?? null)
    }
    return this.props.children
  }
}
