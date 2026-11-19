import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { installMobileGuards } from '@/engine/mobileGuards'
import './index.css'

installMobileGuards()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
