import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { MeetingTopicsProvider } from './context/MeetingTopicsContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MeetingTopicsProvider>
      <App />
    </MeetingTopicsProvider>
  </StrictMode>,
)
