import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App.jsx'
import './styles/index.css'


// Import Clerk Publishable Key with fallback
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_Y3VkZGx5LXNoZWVwLTAuY2xlcmsuYWNjb3VudHMuZGV2JA'

console.log('Clerk Key:', PUBLISHABLE_KEY ? '✅ Found' : '❌ Missing');

if (!PUBLISHABLE_KEY) {
  console.error('Missing Clerk Publishable Key');
  document.getElementById('root').innerHTML = `
    <div style="padding: 40px; text-align: center; font-family: sans-serif;">
      <h1>Configuration Error</h1>
      <p>Missing Clerk authentication key. Please check environment variables.</p>
      <p>Expected: VITE_CLERK_PUBLISHABLE_KEY</p>
    </div>
  `;
}

// Validate key format
if (PUBLISHABLE_KEY && !PUBLISHABLE_KEY.startsWith('pk_')) {
  console.error('Invalid Clerk key format');
}


const root = document.getElementById('root')

if (!root) {
  document.body.innerHTML = '<div style="padding: 20px; text-align: center;"><h1>Error: No root element found</h1></div>'
} else {
  // Show loading state immediately
  root.innerHTML = '<div style="padding: 40px; text-align: center; font-family: sans-serif;"><h1>Marketing Machine</h1><p>Loading authentication...</p></div>'
  
  try {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ClerkProvider>
      </React.StrictMode>
    )
  } catch (error) {
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
}