import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App.jsx'
import './styles/index.css'

console.log('Marketing Machine - Starting with Clerk Authentication...')
console.log('All environment variables:', import.meta.env)

// Import Clerk Publishable Key
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

console.log('Raw Clerk key:', PUBLISHABLE_KEY)

if (!PUBLISHABLE_KEY) {
  console.error('Missing Clerk Publishable Key!')
  throw new Error('Missing Clerk Publishable Key. Add VITE_CLERK_PUBLISHABLE_KEY to your environment variables.')
}

// Validate key format
if (!PUBLISHABLE_KEY.startsWith('pk_')) {
  console.error('Invalid Clerk key format:', PUBLISHABLE_KEY)
  throw new Error('Invalid Clerk Publishable Key format. Must start with pk_')
}

console.log('Clerk configuration loaded successfully with key:', PUBLISHABLE_KEY.substring(0, 20) + '...')

const root = document.getElementById('root')

if (!root) {
  document.body.innerHTML = '<div style="padding: 20px; text-align: center;"><h1>Error: No root element found</h1></div>'
} else {
  // Show loading state immediately
  root.innerHTML = '<div style="padding: 40px; text-align: center; font-family: sans-serif;"><h1>Marketing Machine</h1><p>Loading authentication...</p></div>'
  
  try {
    console.log('Creating ClerkProvider with key:', PUBLISHABLE_KEY)
    
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <ClerkProvider 
          publishableKey={PUBLISHABLE_KEY}
          onError={(error) => {
            console.error('Clerk Provider Error:', error)
          }}
        >
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ClerkProvider>
      </React.StrictMode>
    )
    console.log('App with Clerk authentication rendered successfully!')
  } catch (error) {
    console.error('Error rendering app:', error)
    root.innerHTML = `
      <div style="padding: 40px; text-align: center; font-family: sans-serif;">
        <h1>Marketing Machine</h1>
        <p style="color: red;">Error loading application: ${error.message}</p>
        <p>Check browser console for details</p>
        <details>
          <summary>Technical Details</summary>
          <pre style="text-align: left; background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 4px;">${error.stack}</pre>
        </details>
      </div>
    `
  }
}console.log('Marketing Machine App Starting...', import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ? 'Clerk key found' : 'Clerk key missing')
// Force rebuild Sat Aug 16 03:14:39 AM CEST 2025
