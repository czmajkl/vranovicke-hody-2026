import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/cormorant-garamond/700.css'
import HodyAppV10 from './HodyAppV10'
import './styles.css'
import './onboarding.css'
import './hody-v2.css'
import './hody-v6-copy.css'
import './hody-v9-fix.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HodyAppV10 />
  </React.StrictMode>,
)
