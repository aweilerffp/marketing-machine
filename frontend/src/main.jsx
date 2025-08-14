import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton, useAuth } from '@clerk/clerk-react'
import './styles/index.css'

console.log('Main.jsx loaded with Clerk authentication')

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_Y3VkZGVkLWRlbnQtNzMuY2xlcmsuYWNjb3VudHMuZGV2JA'
console.log('Clerk key loaded:', !!PUBLISHABLE_KEY)

// Simple Home component
function HomePage() {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to Marketing Machine</h2>
      <p className="text-gray-600 mb-6">
        Transform your meeting recordings into engaging LinkedIn content with AI.
      </p>
      
      <SignedOut>
        <div className="space-x-4">
          <SignInButton mode="modal">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium">
              Sign In
            </button>
          </SignInButton>
          <Link 
            to="/login" 
            className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-md font-medium"
          >
            Login Page
          </Link>
        </div>
      </SignedOut>
      
      <SignedIn>
        <div className="space-y-4">
          <p className="text-green-600 font-medium">✅ You are signed in!</p>
          <div className="space-x-4">
            <Link 
              to="/dashboard" 
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md font-medium"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </SignedIn>
    </div>
  )
}

// Simple Login component
function LoginPage() {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Sign In</h2>
      <p className="text-gray-600 mb-6">Authentication will be added here.</p>
      <Link 
        to="/" 
        className="text-blue-600 hover:text-blue-800"
      >
        ← Back to Home
      </Link>
    </div>
  )
}

// Protected Dashboard component  
function DashboardPage() {
  const { isLoaded, isSignedIn } = useAuth()
  
  if (!isLoaded) {
    return <div className="text-center">Loading...</div>
  }
  
  if (!isSignedIn) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
        <p className="text-gray-600 mb-6">You need to sign in to access the dashboard.</p>
        <Link 
          to="/" 
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back to Home
        </Link>
      </div>
    )
  }
  
  return (
    <div className="text-center">
      <div className="mb-4">
        <UserButton />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Dashboard</h2>
      <p className="text-gray-600 mb-6">Welcome to your content dashboard!</p>
      <Link 
        to="/" 
        className="text-blue-600 hover:text-blue-800"
      >
        ← Back to Home
      </Link>
    </div>
  )
}

// Main App component
function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center text-gray-900 mb-8">
          Marketing Machine
        </h1>
        <div className="max-w-2xl mx-auto">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="*" element={
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Page Not Found</h2>
                <Link to="/" className="text-blue-600 hover:text-blue-800">← Back to Home</Link>
              </div>
            } />
          </Routes>
        </div>
      </div>
    </div>
  )
}

const root = document.getElementById('root')
console.log('Root element found:', !!root)

if (!root) {
  document.body.innerHTML = '<div style="padding: 20px; text-align: center;"><h1>Error: No root element found</h1></div>'
} else {
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
    console.log('App with Clerk authentication rendered successfully')
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