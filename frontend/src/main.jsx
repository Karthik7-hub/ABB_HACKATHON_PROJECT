import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import MobileSensor from './MobileSensor.jsx'

const isSensorRoute = window.location.pathname === '/sensor'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isSensorRoute ? <MobileSensor /> : <App />}
  </StrictMode>,
)
