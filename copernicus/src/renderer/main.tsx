import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import SplashScreen from './components/layout/SplashScreen.tsx'
import './index.css'
import { registerCommands } from './commands/commands'

// Register Slash Commands
registerCommands();

const isSplash = window.location.search.includes('window=splash');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isSplash ? <SplashScreen /> : <App />}
  </React.StrictMode>,
)
