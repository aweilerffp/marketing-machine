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
        <div className="space-y-4">
          <Link 
            to="/login"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-md text-lg font-medium"
          >
            Sign In to Get Started
          </Link>
          <p className="text-sm text-gray-500">Demo mode - Use any email/password to sign in</p>
        </div>
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <Link 
          to="/content"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          Create New Content
        </Link>
      </div>
      
      <p className="text-gray-600 mb-6">Welcome back, {user?.email}!</p>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Posts</p>
              <p className="text-2xl font-bold text-gray-900">24</p>
            </div>
            <div className="text-blue-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Published</p>
              <p className="text-2xl font-bold text-gray-900">18</p>
            </div>
            <div className="text-green-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Views</p>
              <p className="text-2xl font-bold text-gray-900">3.2K</p>
            </div>
            <div className="text-purple-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Engagement</p>
              <p className="text-2xl font-bold text-gray-900">4.8%</p>
            </div>
            <div className="text-orange-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      
      {/* Recent Content */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Recent Content</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {[
              { title: "5 AI Trends Reshaping Marketing", status: "published", date: "2 hours ago" },
              { title: "Building Better Customer Relationships", status: "draft", date: "Yesterday" },
              { title: "The Future of Digital Marketing", status: "published", date: "3 days ago" },
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between py-3 border-b last:border-0">
                <div>
                  <p className="font-medium text-gray-900">{item.title}</p>
                  <p className="text-sm text-gray-500">{item.date}</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  item.status === 'published' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ContentPage() {
  const [transcriptText, setTranscriptText] = useState('')
  
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Create Content</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Meeting Transcript</h2>
          <textarea
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            placeholder="Paste your meeting transcript here or upload a file..."
            className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="mt-4 flex gap-3">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium">
              Upload File
            </button>
            <button 
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              disabled={!transcriptText}
            >
              Generate Content
            </button>
          </div>
        </div>
        
        {/* Output Section */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Generated LinkedIn Post</h2>
          <div className="bg-gray-50 p-4 rounded-md min-h-[256px]">
            <p className="text-gray-500 italic">
              {transcriptText ? 
                "Click 'Generate Content' to create your LinkedIn post..." :
                "Add a transcript to get started..."
              }
            </p>
          </div>
          <div className="mt-4 flex gap-3">
            <button className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium" disabled>
              Copy to Clipboard
            </button>
            <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium" disabled>
              Save Draft
            </button>
          </div>
        </div>
      </div>
      
      {/* Tips Section */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">💡 Pro Tips</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Include key discussion points and decisions in your transcript</li>
          <li>• The AI works best with 500-2000 words of content</li>
          <li>• Review and customize the generated content before posting</li>
        </ul>
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