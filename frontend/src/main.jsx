import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App.jsx'
import SimpleApp from './SimpleApp.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './styles/index.css'


// Import Clerk Publishable Key with hardcoded fallback for production
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_Y3VkZGx5LXNoZWVwLTAuY2xlcmsuYWNjb3VudHMuZGV2JA'

console.log('=== MARKETING MACHINE DEBUG INFO ===');
console.log('Environment variables check:');
console.log('- NODE_ENV:', import.meta.env.NODE_ENV);
console.log('- MODE:', import.meta.env.MODE);
console.log('- VITE_CLERK_PUBLISHABLE_KEY present:', !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
console.log('- Final PUBLISHABLE_KEY:', PUBLISHABLE_KEY ? 'Found' : 'Missing');
console.log('- Window location:', window.location.href);
console.log('- Document ready state:', document.readyState);
console.log('=====================================');

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
  root.innerHTML = '<div style="padding: 40px; text-align: center; font-family: sans-serif;"><h1>🔄 Marketing Machine</h1><p>⚡ Initializing React App...</p><p style="font-size: 12px; color: #666;">If you see this message, the app is starting up.</p></div>'
  
  try {
    console.log('Attempting to render React app...');
    
    // Render full React app with authentication
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <ErrorBoundary>
          <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </ClerkProvider>
        </ErrorBoundary>
      </React.StrictMode>
    )
    
    console.log('React app render completed');
  } catch (error) {
    console.error('React render failed, trying fallback:', error);
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