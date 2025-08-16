import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles/index.css'

// Add immediate visual feedback
console.log('Marketing Machine - Starting...')

const root = document.getElementById('root')

if (!root) {
  document.body.innerHTML = '<div style="padding: 20px; text-align: center;"><h1>Error: No root element found</h1></div>'
} else {
  // Show loading state immediately
  root.innerHTML = '<div style="padding: 40px; text-align: center; font-family: sans-serif;"><h1>Marketing Machine</h1><p>Loading application...</p></div>'
  
  try {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </React.StrictMode>
    )
    console.log('App rendered successfully!')
  } catch (error) {
    console.error('Error rendering app:', error)
    root.innerHTML = `
      <div style="padding: 40px; text-align: center; font-family: sans-serif;">
        <h1>Marketing Machine</h1>
        <p style="color: red;">Error loading application</p>
        <p>${error.message}</p>
      </div>
    `
  }
}