import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback: (error: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

/** Catches render-time crashes (e.g. the 3D canvas failing to start) and shows a recovery screen. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    const { error } = this.state
    if (error) return this.props.fallback(error, () => this.setState({ error: null }))
    return this.props.children
  }
}
