import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'materialize-css/dist/css/materialize.min.css'
import './styles/materialize-customizations.scss'
import './styles/design-system.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
