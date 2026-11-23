import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import "bootstrap/dist/css/bootstrap.min.css";
import { getIndexes, getIndexSeries, getScreener } from './api/client'

// Start the homepage's API calls right away, in parallel with React's first
// render, instead of waiting for HomePage to mount. The client's GET cache
// hands these same promises to HomePage.
if (window.location.pathname === '/') {
  for (const p of [getScreener(), getIndexes(), getIndexSeries('MBI10'), getIndexSeries('OMB')]) {
    p.catch(() => {}) // HomePage handles errors when it awaits these
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
