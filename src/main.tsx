import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/cormorant-garamond/700.css'
import HodyAppV8 from './HodyAppV8'
import './styles.css'
import './onboarding.css'
import './hody-v2.css'
import './hody-v6-copy.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HodyAppV8 />
  </React.StrictMode>,
)
