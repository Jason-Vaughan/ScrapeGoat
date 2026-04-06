import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AppProvider } from './context/AppContext'
import App from './App.tsx'
import { registerServiceWorker } from './serviceWorkerRegistration'

registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
)
