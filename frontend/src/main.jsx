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
  console.log('✅ Root element found, starting React app...');
  
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
    console.error('❌ React render failed:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Show detailed error in UI
    const errorHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; font-family: system-ui; background: #fef2f2; padding: 20px;">
        <div style="background: white; padding: 40px; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); max-width: 600px; border-left: 4px solid #ef4444;">
          <h1 style="color: #dc2626; margin-bottom: 20px; font-size: 1.5rem;">⚠️ React App Failed to Load</h1>
          <p style="color: #374151; margin-bottom: 16px;"><strong>Error:</strong> ${error.message}</p>
          <details style="margin-top: 20px;">
            <summary style="cursor: pointer; color: #6b7280; font-weight: 600;">Technical Details</summary>
            <pre style="background: #f9fafb; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px; margin-top: 10px;">${error.stack}</pre>
          </details>
          <div style="margin-top: 24px; padding: 16px; background: #f0f9ff; border-radius: 8px;">
            <h3 style="color: #1e40af; margin: 0 0 8px 0;">Troubleshooting:</h3>
            <ul style="color: #374151; margin: 0; padding-left: 20px;">
              <li>Check browser console for additional errors</li>
              <li>Verify Clerk authentication key is configured</li>
              <li>Try refreshing the page</li>
            </ul>
          </div>
          <button onclick="window.location.reload()" style="margin-top: 20px; background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer;">
            Reload Page
          </button>
        </div>
      </div>
    `;
    
    // Replace the loading content with error message
    root.innerHTML = errorHTML;
  }
}