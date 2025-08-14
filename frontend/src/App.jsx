import React from 'react'
import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { useAuth, SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react'

// Simple inline components to avoid import issues
function LoadingSpinner() {
  return (
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  )
}

function SimpleLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/dashboard" className="text-xl font-bold text-gray-900">
                Marketing Machine
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/dashboard" className="text-gray-700 hover:text-gray-900">Dashboard</Link>
              <Link to="/content" className="text-gray-700 hover:text-gray-900">Content</Link>
              <Link to="/analytics" className="text-gray-700 hover:text-gray-900">Analytics</Link>
              <UserButton />
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}

function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Marketing Machine</h1>
        <p className="text-xl text-gray-600 mb-8">Transform your meeting recordings into engaging LinkedIn content</p>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-md text-lg font-medium">
              Sign In to Get Started
            </button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <div className="space-y-4">
            <p className="text-green-600 font-medium">✅ Welcome back!</p>
            <Link 
              to="/dashboard" 
              className="inline-block bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-md text-lg font-medium"
            >
              Go to Dashboard
            </Link>
          </div>
        </SignedIn>
      </div>
    </div>
  )
}

function DashboardPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Content Created</h3>
          <p className="text-3xl font-bold text-blue-600">12</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Posts Published</h3>
          <p className="text-3xl font-bold text-green-600">8</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Engagement Rate</h3>
          <p className="text-3xl font-bold text-purple-600">4.2%</p>
        </div>
      </div>
    </div>
  )
}

function ContentPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Create Content</h1>
      <div className="bg-white p-6 rounded-lg shadow">
        <p className="text-gray-600">Upload your meeting recordings here to generate LinkedIn content.</p>
      </div>
    </div>
  )
}

function AnalyticsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Analytics</h1>
      <div className="bg-white p-6 rounded-lg shadow">
        <p className="text-gray-600">View your content performance metrics here.</p>
      </div>
    </div>
  )
}

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const { isLoaded, isSignedIn } = useAuth()

  console.log('ProtectedRoute - isLoaded:', isLoaded, 'isSignedIn:', isSignedIn)

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <SignedIn>
      {children}
    </SignedIn>
  )
}

// Public Route wrapper (redirect if authenticated)
function PublicRoute({ children }) {
  const { isLoaded, isSignedIn } = useAuth()

  console.log('PublicRoute - isLoaded:', isLoaded, 'isSignedIn:', isSignedIn)

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <>
      <SignedOut>
        {children}
      </SignedOut>
      <SignedIn>
        <Navigate to="/dashboard" replace />
      </SignedIn>
    </>
  )
}

function App() {
  console.log('App component loaded with full routing')
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        {/* Public Routes */}
        <Route 
          path="/" 
          element={
            <PublicRoute>
              <HomePage />
            </PublicRoute>
          } 
        />
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } 
        />

        {/* Protected Routes */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <SimpleLayout>
                <DashboardPage />
              </SimpleLayout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/content" 
          element={
            <ProtectedRoute>
              <SimpleLayout>
                <ContentPage />
              </SimpleLayout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/analytics" 
          element={
            <ProtectedRoute>
              <SimpleLayout>
                <AnalyticsPage />
              </SimpleLayout>
            </ProtectedRoute>
          } 
        />

        {/* 404 Route */}
        <Route path="*" element={
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">404 - Page Not Found</h1>
              <Link to="/" className="text-blue-600 hover:text-blue-800">← Back to Home</Link>
            </div>
          </div>
        } />
      </Routes>
    </div>
  )
}

export default App