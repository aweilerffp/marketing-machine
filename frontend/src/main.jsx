import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { ReactQueryDevtools } from 'react-query/devtools'
import { Toaster } from 'react-hot-toast'
import { ClerkProvider } from '@clerk/clerk-react'

import App from './App.jsx'
import './styles/index.css'

console.log('Main.jsx loaded with full app structure')

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_Y3VkZGVkLWRlbnQtNzMuY2xlcmsuYWNjb3VudHMuZGV2JA'
console.log('Clerk key loaded:', !!PUBLISHABLE_KEY)

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false
        }
        return failureCount < 3
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
    mutations: {
      retry: 1,
    },
  },
})

const root = document.getElementById('root')
console.log('Root element found:', !!root)

if (!root) {
  document.body.innerHTML = '<div style="padding: 20px; text-align: center;"><h1>Error: No root element found</h1></div>'
} else {
  try {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <ClerkProvider 
          publishableKey={PUBLISHABLE_KEY}
          afterSignOutUrl="/"
        >
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <App />
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#363636',
                    color: '#fff',
                  },
                  success: {
                    duration: 3000,
                    iconTheme: {
                      primary: '#22c55e',
                      secondary: '#fff',
                    },
                  },
                  error: {
                    duration: 5000,
                    iconTheme: {
                      primary: '#ef4444',
                      secondary: '#fff',
                    },
                  },
                }}
              />
            </BrowserRouter>
            {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
          </QueryClientProvider>
        </ClerkProvider>
      </React.StrictMode>
    )
    console.log('Full app with all providers rendered successfully')
  } catch (error) {
    console.error('Failed to render app:', error)
    document.body.innerHTML = `
      <div style="padding: 20px; text-align: center;">
        <h1>Render Error</h1>
        <p style="color: red;">Error: ${error.message}</p>
        <pre style="text-align: left; background: #f5f5f5; padding: 10px; border-radius: 5px;">
${error.stack}
        </pre>
      </div>
    `
  }
}