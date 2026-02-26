import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import SplashScreen from './components/layout/SplashScreen.tsx'
import './index.css'
import { registerCommands } from './commands/commands'
import { useToastStore } from './store/toastStore'
import { ErrorBoundary } from './components/layout/ErrorBoundary'

// Register Slash Commands
registerCommands();

// Global renderer error safety nets
window.onerror = (_msg, _url, _line, _col, error) => {
  const message = error?.message ?? String(_msg)
  useToastStore.getState().addToast(`Renderer error: ${message}`, 'error')
  console.error('[Renderer] window.onerror:', error)
}

window.onunhandledrejection = (event: PromiseRejectionEvent) => {
  const message = event.reason instanceof Error
    ? event.reason.message
    : String(event.reason)
  useToastStore.getState().addToast(`Unhandled rejection: ${message}`, 'error')
  console.error('[Renderer] unhandledRejection:', event.reason)
}

// Listen for critical errors from the main process
if (window.ipcRenderer) {
  window.ipcRenderer.on('app:critical-error', (_e: unknown, payload: any) => {
    const p = payload as { type: string; message: string };
    useToastStore.getState().addToast(`[Main] ${p.type}: ${p.message}`, 'error')
  })
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
