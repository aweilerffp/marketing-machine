import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App.jsx'
import './styles/index.css'

console.log('Marketing Machine - Starting with Clerk Authentication...')

// Import Clerk Publishable Key
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Clerk Publishable Key. Add VITE_CLERK_PUBLISHABLE_KEY to your environment variables.')
}

console.log('Clerk configuration loaded successfully')

const root = document.getElementById('root')

if (!root) {
  document.body.innerHTML = '<div style="padding: 20px; text-align: center;"><h1>Error: No root element found</h1></div>'
} else {
  // Show loading state immediately
  root.innerHTML = '<div style="padding: 40px; text-align: center; font-family: sans-serif;"><h1>Marketing Machine</h1><p>Loading authentication...</p></div>'
  
  try {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <ClerkProvider 
          publishableKey={PUBLISHABLE_KEY}
          afterSignInUrl="/dashboard"
          afterSignUpUrl="/dashboard"
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
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
        <p style="color: red;">Error loading application</p>
        <p>${error.message}</p>
      </div>
    `
  }
}console.log('Marketing Machine App Starting...', import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ? 'Clerk key found' : 'Clerk key missing')
