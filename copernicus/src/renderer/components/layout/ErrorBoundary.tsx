import React from 'react'
import log from '../../utils/logger'

interface State { hasError: boolean; message: string }

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  State
> {
  constructor(props: React.PropsWithChildren) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    log.error('[ErrorBoundary] Caught error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-black text-copernicus-phosphor font-mono">
          <p className="text-lg mb-2 phosphor-glow">⚠ Renderer Error</p>
          <p className="text-sm opacity-60 mb-6 max-w-lg text-center">
            {this.state.message}
          </p>
          <button
            className="border border-copernicus-phosphor/40 px-6 py-2 text-sm hover:bg-copernicus-phosphor/10 transition-colors"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
