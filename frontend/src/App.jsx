import React, { useState } from 'react'
import { Routes, Route, Link, useNavigate } from 'react-router-dom'

// Simple auth context
const AuthContext = React.createContext()

function useAuth() {
  return React.useContext(AuthContext)
}

// Simple Layout
function Layout({ children }) {
  const { user, logout } = useAuth()
  
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="text-xl font-bold text-gray-900">
                Marketing Machine
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <Link to="/dashboard" className="text-gray-700 hover:text-gray-900">Dashboard</Link>
                  <Link to="/content" className="text-gray-700 hover:text-gray-900">Content</Link>
                  <Link to="/analytics" className="text-gray-700 hover:text-gray-900">Analytics</Link>
                  <button 
                    onClick={logout}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <Link 
                  to="/login"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
                >
                  Sign In
                </Link>
              )}
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

// Pages
function HomePage() {
  const { user } = useAuth()
  
  return (
    <div className="text-center py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">Marketing Machine</h1>
      <p className="text-xl text-gray-600 mb-8">Transform your meeting recordings into engaging LinkedIn content</p>
      
      {user ? (
        <div className="space-y-4">
          <p className="text-green-600 font-medium">Welcome back, {user.email}!</p>
          <Link 
            to="/dashboard" 
            className="inline-block bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-md text-lg font-medium"
          >
            Go to Dashboard
          </Link>
        </div>
      ) : (
        <Link 
          to="/login"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-md text-lg font-medium"
        >
          Sign In to Get Started
        </Link>
      )}
    </div>
  )
}

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()
  
  const handleSubmit = (e) => {
    e.preventDefault()
    if (email && password) {
      login({ email })
      navigate('/dashboard')
    }
  }
  
  return (
    <div className="max-w-md mx-auto mt-8">
      <div className="bg-white p-8 rounded-lg shadow">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Sign In</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="••••••••"
              required
            />
          </div>
          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-medium"
          >
            Sign In
          </button>
        </form>
        <p className="mt-4 text-sm text-gray-600 text-center">
          Demo: Enter any email and password to sign in
        </p>
      </div>
    </div>
  )
}

function DashboardPage() {
  const { user } = useAuth()
  
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <p className="text-gray-600 mb-6">Welcome, {user?.email}!</p>
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

// Protected Route
function ProtectedRoute({ children }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  
  React.useEffect(() => {
    if (!user) {
      navigate('/login')
    }
  }, [user, navigate])
  
  return user ? children : null
}

// Main App
function App() {
  const [user, setUser] = useState(null)
  
  const login = (userData) => {
    setUser(userData)
  }
  
  const logout = () => {
    setUser(null)
  }
  
  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Layout><DashboardPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/content" element={
            <ProtectedRoute>
              <Layout><ContentPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/analytics" element={
            <ProtectedRoute>
              <Layout><AnalyticsPage /></Layout>
            </ProtectedRoute>
          } />
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
    </AuthContext.Provider>
  )
}

export default App