import log from '../utils/logger'
import React from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    log.error('[ErrorBoundary]', error, errorInfo)
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div className="p-8 m-4 rounded-lg bg-red-950/30 border border-red-900 text-red-400 font-mono text-center max-w-md mx-auto">
          <h3 className="text-sm font-bold uppercase tracking-widest mb-2">System Fault</h3>
          <p className="text-xs opacity-80 mb-4">
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-1.5 rounded border border-red-900 text-[11px] font-bold uppercase tracking-widest hover:bg-red-900/20 transition-colors"
          >
            Reset Component
          </button>
        </div>
      )
    }
    return this.props.children
  }
}