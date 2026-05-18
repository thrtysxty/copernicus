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
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div style={{
          padding: '2rem',
          margin: '1rem',
          borderRadius: '8px',
          background: '#2a1a1a',
          border: '1px solid #ff4444',
          color: '#ff8888',
          fontFamily: 'monospace',
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0' }}>Something went wrong</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8 }}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: '1rem',
              padding: '0.4rem 1rem',
              borderRadius: '4px',
              border: '1px solid #ff4444',
              background: 'transparent',
              color: '#ff8888',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}