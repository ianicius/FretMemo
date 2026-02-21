import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/i18n' // Import i18n early
import App from './App.tsx'
import { initAnalyticsV2 } from './lib/analytics'
initAnalyticsV2()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
