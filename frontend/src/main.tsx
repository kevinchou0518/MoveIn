import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { LoginProvider } from './Auth'
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><LoginProvider><App /></LoginProvider></React.StrictMode>)
