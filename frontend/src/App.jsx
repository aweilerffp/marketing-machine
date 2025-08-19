import React, { useState } from 'react'
import { Routes, Route, Link, Navigate } from 'react-router-dom'
import { useAuth, SignedIn, SignedOut, SignInButton, UserButton, SignIn, SignUp, useClerk } from '@clerk/clerk-react'
import WebhookSetup from './pages/WebhookSetup'
import WebhookDashboard from './components/WebhookDashboard'

// Layout Component with Clerk Integration
function Layout({ children }) {
  const { user } = useAuth()
  
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
              <SignedIn>
                <Link to="/dashboard" className="text-gray-700 hover:text-gray-900">Dashboard</Link>
                <Link to="/webhooks" className="text-gray-700 hover:text-gray-900">Webhooks</Link>
                <Link to="/content" className="text-gray-700 hover:text-gray-900">Content</Link>
                <Link to="/analytics" className="text-gray-700 hover:text-gray-900">Analytics</Link>
                <Link to="/profile" className="text-gray-700 hover:text-gray-900">Profile</Link>
                <UserButton 
                  appearance={{
                    elements: {
                      avatarBox: "w-8 h-8"
                    }
                  }}
                />
              </SignedIn>
              <SignedOut>
                <Link 
                  to="/sign-in"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  Sign In
                </Link>
              </SignedOut>
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

// Test HomePage with forced visible content
function HomePage() {
  console.log('HomePage component rendering...');
  
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f9fafb', 
      padding: '20px',
      position: 'relative',
      zIndex: 1
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          fontWeight: 'bold', 
          color: '#111827', 
          marginBottom: '16px',
          textShadow: '1px 1px 2px rgba(0,0,0,0.1)'
        }}>
          🚀 Marketing Machine
        </h1>
        <p style={{ 
          fontSize: '1.25rem', 
          color: '#6b7280', 
          marginBottom: '32px',
          fontWeight: '500'
        }}>
          Transform your meeting recordings into engaging LinkedIn content
        </p>
        
        <div style={{ 
          backgroundColor: '#ffffff', 
          padding: '24px', 
          borderRadius: '8px', 
          marginBottom: '32px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ 
            fontSize: '1.5rem', 
            color: '#111827', 
            marginBottom: '16px' 
          }}>
            ✅ Full React App: READY
          </h2>
          <p style={{ color: '#059669', fontWeight: '500' }}>
            Authentication & onboarding enabled
          </p>
        </div>
        
        {/* Always show buttons for debugging */}
        <div style={{ marginBottom: '20px' }}>
          <Link 
            to="/sign-in"
            style={{
              display: 'inline-block',
              backgroundColor: '#2563eb',
              color: 'white',
              padding: '12px 32px',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '1.125rem',
              fontWeight: '500',
              marginRight: '16px'
            }}
          >
            Get Started Now
          </Link>
          <Link 
            to="/sign-up"
            style={{
              display: 'inline-block',
              border: '1px solid #2563eb',
              color: '#2563eb',
              backgroundColor: 'white',
              padding: '12px 32px',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '1.125rem',
              fontWeight: '500'
            }}
          >
            Create Account
          </Link>
        </div>
        
        <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          Professional AI-powered content creation
        </p>
        
      </div>
    </div>
  )
}

function SignInPage() {
  const { isLoaded, isSignedIn } = useAuth()
  const [showTimeout, setShowTimeout] = React.useState(false)
  
  // Show timeout message if Clerk doesn't load within 10 seconds
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (!isLoaded) {
        setShowTimeout(true)
      }
    }, 10000)
    
    return () => clearTimeout(timer)
  }, [isLoaded])
  
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backgroundColor: '#f9fafb' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>
            Sign in to your account
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            Or{' '}
            <Link 
              to="/sign-up" 
              style={{ color: '#2563eb', textDecoration: 'none', fontWeight: '500' }}
            >
              create a new account
            </Link>
          </p>
        </div>
        
        {/* Show loading state */}
        {!isLoaded && !showTimeout && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid #f3f3f3', borderTop: '3px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <p style={{ marginTop: '16px', color: '#6b7280' }}>Loading Clerk...</p>
          </div>
        )}
        
        {/* Show timeout message */}
        {!isLoaded && showTimeout && (
          <div style={{ backgroundColor: '#fef2f2', padding: '20px', borderRadius: '8px', border: '1px solid #fecaca' }}>
            <h3 style={{ color: '#dc2626', fontSize: '1.125rem', fontWeight: '600', marginBottom: '8px' }}>
              Authentication Service Unavailable
            </h3>
            <p style={{ color: '#7f1d1d', fontSize: '0.875rem', marginBottom: '16px' }}>
              Clerk authentication failed to load. This might be a network issue or service outage.
            </p>
            <button 
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#dc2626',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '4px',
                border: 'none',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
                marginRight: '8px'
              }}
            >
              Retry
            </button>
            <button 
              onClick={() => window.location.href = '/dashboard'}
              style={{
                backgroundColor: '#6b7280',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '4px',
                border: 'none',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Continue as Demo
            </button>
          </div>
        )}
        
        {/* Clerk component container */}
        {isLoaded && (
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <SignIn 
              afterSignInUrl="/dashboard"
              signUpUrl="/sign-up"
              appearance={{
                elements: {
                  rootBox: {
                    width: '100%'
                  },
                  card: {
                    backgroundColor: 'white',
                    boxShadow: 'none'
                  }
                }
              }}
            />
          </div>
        )}
        
      </div>
    </div>
  )
}

function SignUpPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backgroundColor: '#f9fafb' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>
            Create your account
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            Or{' '}
            <Link 
              to="/sign-in" 
              style={{ color: '#2563eb', textDecoration: 'none', fontWeight: '500' }}
            >
              sign in to existing account
            </Link>
          </p>
        </div>
        
        {/* Debug container for Clerk */}
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <SignUp 
            afterSignUpUrl="/dashboard"
            signInUrl="/sign-in"
            appearance={{
              elements: {
                rootBox: {
                  width: '100%'
                },
                card: {
                  backgroundColor: 'white',
                  boxShadow: 'none'
                }
              }
            }}
          />
          
        </div>
      </div>
    </div>
  )
}

function ProfilePage() {
  const { user } = useAuth()
  
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Profile</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-6">
          <img 
            className="h-24 w-24 rounded-full"
            src={user?.imageUrl}
            alt={user?.fullName}
          />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{user?.fullName}</h2>
            <p className="text-gray-600">{user?.primaryEmailAddress?.emailAddress}</p>
            <p className="text-sm text-gray-500">
              Member since {new Date(user?.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Account Information</h3>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Email</dt>
                <dd className="text-sm text-gray-900">{user?.primaryEmailAddress?.emailAddress}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">User ID</dt>
                <dd className="text-sm text-gray-900 font-mono">{user?.id}</dd>
              </div>
            </dl>
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Usage Statistics</h3>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Posts Created</dt>
                <dd className="text-sm text-gray-900">24</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Total Engagement</dt>
                <dd className="text-sm text-gray-900">3,847 interactions</dd>
              </div>
            </dl>
          </div>
        </div>
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
      
      <p className="text-gray-600 mb-6">Welcome back, {user?.firstName}!</p>
      
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
      
      {/* Webhook Dashboard */}
      <div className="mb-8">
        <WebhookDashboard />
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
  const [generatedContent, setGeneratedContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  
  const generateContent = () => {
    setIsGenerating(true)
    // Simulate AI generation
    setTimeout(() => {
      const templates = [
        `🚀 Key insights from today's strategy session:\n\n${transcriptText.substring(0, 100)}...\n\n✅ Action items identified\n📈 Growth opportunities mapped\n🎯 Clear next steps defined\n\n#Leadership #Strategy #Innovation`,
        `💡 Transformative discussion highlights:\n\n"${transcriptText.substring(0, 80)}..."\n\nThree takeaways that will change how we approach our market:\n1. Customer-first innovation\n2. Data-driven decisions\n3. Agile implementation\n\n#BusinessGrowth #Innovation`,
        `🎯 Today's breakthrough moment:\n\n${transcriptText.substring(0, 120)}...\n\nSometimes the best ideas come from collaborative thinking. Excited to implement these strategies!\n\n#Teamwork #Success #Growth`
      ]
      setGeneratedContent(templates[Math.floor(Math.random() * templates.length)])
      setIsGenerating(false)
    }, 2000)
  }
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedContent)
    alert('Content copied to clipboard!')
  }
  
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
            <button 
              onClick={() => setTranscriptText('We discussed our Q4 marketing strategy, focusing on AI-driven content creation and automation. The team agreed to implement new tools for social media management and increase our LinkedIn presence. Key metrics to track include engagement rates and lead generation.')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Load Sample
            </button>
            <button 
              onClick={generateContent}
              className={`${isGenerating ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'} text-white px-4 py-2 rounded-md text-sm font-medium`}
              disabled={!transcriptText || isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate Content'}
            </button>
          </div>
        </div>
        
        {/* Output Section */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Generated LinkedIn Post</h2>
          <div className="bg-gray-50 p-4 rounded-md min-h-[256px]">
            {generatedContent ? (
              <div className="whitespace-pre-wrap text-gray-800">{generatedContent}</div>
            ) : (
              <p className="text-gray-500 italic">
                {transcriptText ? 
                  "Click 'Generate Content' to create your LinkedIn post..." :
                  "Add a transcript to get started..."
                }
              </p>
            )}
          </div>
          <div className="mt-4 flex gap-3">
            <button 
              onClick={copyToClipboard}
              className={`${generatedContent ? 'bg-gray-600 hover:bg-gray-700' : 'bg-gray-400'} text-white px-4 py-2 rounded-md text-sm font-medium`}
              disabled={!generatedContent}
            >
              Copy to Clipboard
            </button>
            <button 
              className={`${generatedContent ? 'bg-purple-600 hover:bg-purple-700' : 'bg-purple-400'} text-white px-4 py-2 rounded-md text-sm font-medium`}
              disabled={!generatedContent}
            >
              Save Draft
            </button>
          </div>
        </div>
      </div>
      
      {/* Tips Section */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">💡 Pro Tips</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Click "Load Sample" to try with example content</li>
          <li>• The AI works best with 500-2000 words of content</li>
          <li>• Review and customize the generated content before posting</li>
        </ul>
      </div>
    </div>
  )
}

function AnalyticsPage() {
  const performanceData = [
    { post: "5 AI Trends Reshaping Marketing", views: 2840, likes: 156, comments: 23, shares: 8 },
    { post: "Building Better Customer Relationships", views: 1920, likes: 89, comments: 15, shares: 4 },
    { post: "The Future of Digital Marketing", views: 3150, likes: 203, comments: 31, shares: 12 },
    { post: "Leadership in Remote Teams", views: 1680, likes: 76, comments: 9, shares: 3 },
  ]
  
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Analytics</h1>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Reach</p>
              <p className="text-2xl font-bold text-gray-900">9,590</p>
              <p className="text-xs text-green-600">↗ +12% vs last month</p>
            </div>
            <div className="text-blue-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Engagement</p>
              <p className="text-2xl font-bold text-gray-900">5.2%</p>
              <p className="text-xs text-green-600">↗ +0.8% vs last month</p>
            </div>
            <div className="text-green-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Best Performing</p>
              <p className="text-lg font-bold text-gray-900">AI Trends</p>
              <p className="text-xs text-blue-600">3,150 views</p>
            </div>
            <div className="text-purple-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      
      {/* Performance Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Post Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Post</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Views</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Likes</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comments</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shares</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Engagement</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {performanceData.map((item, index) => {
                const engagement = ((item.likes + item.comments + item.shares) / item.views * 100).toFixed(1)
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{item.post}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{item.views.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{item.likes}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{item.comments}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{item.shares}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        parseFloat(engagement) > 6 ? 'bg-green-100 text-green-800' :
                        parseFloat(engagement) > 4 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {engagement}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Protected Route Component
function ProtectedRoute({ children }) {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />
  }

  return children
}

// Main App Component
function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/sign-up" element={<SignUpPage />} />

      {/* Protected Routes */}
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <Layout>
              <DashboardPage />
            </Layout>
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/content" 
        element={
          <ProtectedRoute>
            <Layout>
              <ContentPage />
            </Layout>
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/webhooks" 
        element={
          <ProtectedRoute>
            <Layout>
              <WebhookSetup />
            </Layout>
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/analytics" 
        element={
          <ProtectedRoute>
            <Layout>
              <AnalyticsPage />
            </Layout>
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/profile" 
        element={
          <ProtectedRoute>
            <Layout>
              <ProfilePage />
            </Layout>
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
  )
}

export default App