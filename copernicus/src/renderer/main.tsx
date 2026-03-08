import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import SplashScreen from './components/layout/SplashScreen.tsx'
import './index.css'
import { registerCommands } from './commands/commands'
import { useToastStore } from './store/toastStore'
import { ErrorBoundary } from './components/layout/ErrorBoundary'
import log from './utils/logger'

// Register Slash Commands
registerCommands();

// Global renderer error safety nets
window.onerror = (_msg, _url, _line, _col, error) => {
  const message = error?.message ?? String(_msg)
  useToastStore.getState().addToast(`Renderer error: ${message}`, 'error')
  log.error('[Renderer] window.onerror:', error)
}

window.onunhandledrejection = (event: PromiseRejectionEvent) => {
  const message = event.reason instanceof Error
    ? event.reason.message
    : String(event.reason)
  useToastStore.getState().addToast(`Unhandled rejection: ${message}`, 'error')
  log.error('[Renderer] unhandledRejection:', event.reason)
}

const isSplash = window.location.search.includes('window=splash');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isSplash ? (
      <SplashScreen />
    ) : (
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    )}
  </React.StrictMode>,
)
