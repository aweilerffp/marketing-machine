import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { ReactQueryDevtools } from 'react-query/devtools'
import { Toaster } from 'react-hot-toast'
import { ClerkProvider } from '@clerk/clerk-react'

import App from './App.jsx'
import './styles/index.css'

console.log('Main.jsx loaded')

// Import your Clerk Publishable Key
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_Y3VkZGVkLWRlbnQtNzMuY2xlcmsuYWNjb3VudHMuZGV2JA'

console.log('Clerk key:', PUBLISHABLE_KEY ? 'Found' : 'Missing')

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

try {
  ReactDOM.createRoot(document.getElementById('root')).render(
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
    </React.StrictMode>,
  )
  console.log('App rendered successfully')
} catch (error) {
  console.error('Failed to render app:', error)
  // Fallback render without Clerk
  ReactDOM.createRoot(document.getElementById('root')).render(
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Marketing Machine</h1>
      <p>Loading...</p>
      <p style={{ color: 'red' }}>Error: {error.message}</p>
    </div>
  )
}