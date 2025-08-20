import React from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import { useAuth, SignedIn, SignedOut, SignIn, SignUp, UserButton } from '@clerk/clerk-react';

// Layout Component
function Layout({ children }) {
  const { user } = useAuth();
  
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f7fafc' }}>
      <nav style={{
        backgroundColor: 'white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        padding: '16px 0'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Link to="/" style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: '#2d3748',
            textDecoration: 'none'
          }}>
            🚀 Marketing Machine
          </Link>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <SignedIn>
              <Link to="/dashboard" style={{ color: '#4a5568', textDecoration: 'none' }}>Dashboard</Link>
              <Link to="/webhooks" style={{ color: '#4a5568', textDecoration: 'none' }}>Webhooks</Link>
              <Link to="/content" style={{ color: '#4a5568', textDecoration: 'none' }}>Content</Link>
              <UserButton 
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8"
                  }
                }}
                afterSignOutUrl="/"
              />
            </SignedIn>
            <SignedOut>
              <Link
                to="/sign-in"
                style={{
                  backgroundColor: '#3182ce',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontWeight: '500'
                }}
              >
                Sign In
              </Link>
            </SignedOut>
          </div>
        </div>
      </nav>
      
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
        {children}
      </main>
    </div>
  );
}

// Homepage
function HomePage() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <h1 style={{ 
        fontSize: '3rem', 
        fontWeight: 'bold', 
        color: '#2d3748', 
        marginBottom: '20px' 
      }}>
        🚀 Marketing Machine
      </h1>
      <p style={{ 
        fontSize: '1.25rem', 
        color: '#6b7280', 
        marginBottom: '40px' 
      }}>
        Transform your meeting recordings into engaging LinkedIn content
      </p>
      
      <div style={{
        display: 'inline-block',
        backgroundColor: '#10b981',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '20px',
        fontSize: '0.9rem',
        fontWeight: '600',
        marginBottom: '40px'
      }}>
        ✅ Production Ready
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '20px', 
        margin: '40px 0',
        maxWidth: '900px',
        marginLeft: 'auto',
        marginRight: 'auto'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '12px',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '15px' }}>🤖</div>
          <h3 style={{ color: '#2d3748', marginBottom: '15px' }}>AI Content Creation</h3>
          <p style={{ color: '#4a5568', lineHeight: '1.6' }}>
            Advanced AI transforms meeting transcripts into professional LinkedIn posts
          </p>
        </div>
        
        <div style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '12px',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '15px' }}>🔗</div>
          <h3 style={{ color: '#2d3748', marginBottom: '15px' }}>Webhook Integration</h3>
          <p style={{ color: '#4a5568', lineHeight: '1.6' }}>
            Connect with Zoom, Teams, and other meeting platforms automatically
          </p>
        </div>
        
        <div style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '12px',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '15px' }}>📊</div>
          <h3 style={{ color: '#2d3748', marginBottom: '15px' }}>Analytics Dashboard</h3>
          <p style={{ color: '#4a5568', lineHeight: '1.6' }}>
            Track performance and engagement metrics for your content
          </p>
        </div>
      </div>

      <div style={{ marginTop: '40px' }}>
        <SignedOut>
          <Link
            to="/sign-up"
            style={{
              backgroundColor: '#10b981',
              color: 'white',
              padding: '15px 30px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '1.1rem',
              fontWeight: '600',
              marginRight: '15px'
            }}
          >
            Get Started Now
          </Link>
          <Link
            to="/sign-in"
            style={{
              backgroundColor: '#3182ce',
              color: 'white',
              padding: '15px 30px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '1.1rem',
              fontWeight: '600'
            }}
          >
            Sign In
          </Link>
        </SignedOut>
        <SignedIn>
          <Link
            to="/dashboard"
            style={{
              backgroundColor: '#3182ce',
              color: 'white',
              padding: '15px 30px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '1.1rem',
              fontWeight: '600'
            }}
          >
            Go to Dashboard
          </Link>
        </SignedIn>
      </div>
    </div>
  );
}

// Sign In Page
function SignInPage() {
  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h1 style={{
          textAlign: 'center',
          fontSize: '2rem',
          fontWeight: 'bold',
          color: '#2d3748',
          marginBottom: '30px'
        }}>
          Welcome Back
        </h1>
        
        <SignIn 
          afterSignInUrl="/dashboard"
          signUpUrl="/sign-up"
          redirectUrl="/dashboard"
          appearance={{
            elements: {
              rootBox: { width: '100%' },
              card: { backgroundColor: 'transparent', boxShadow: 'none' },
              headerTitle: { fontSize: '1.5rem' },
              headerSubtitle: { color: '#6b7280' }
            }
          }}
        />
        
        <p style={{
          textAlign: 'center',
          marginTop: '20px',
          color: '#6b7280'
        }}>
          Don't have an account?{' '}
          <Link 
            to="/sign-up"
            style={{ color: '#3182ce', textDecoration: 'none', fontWeight: '500' }}
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

// Sign Up Page
function SignUpPage() {
  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h1 style={{
          textAlign: 'center',
          fontSize: '2rem',
          fontWeight: 'bold',
          color: '#2d3748',
          marginBottom: '30px'
        }}>
          Create Account
        </h1>
        
        <SignUp 
          afterSignUpUrl="/dashboard"
          signInUrl="/sign-in"
          redirectUrl="/dashboard"
          appearance={{
            elements: {
              rootBox: { width: '100%' },
              card: { backgroundColor: 'transparent', boxShadow: 'none' },
              headerTitle: { fontSize: '1.5rem' },
              headerSubtitle: { color: '#6b7280' }
            }
          }}
        />
        
        <p style={{
          textAlign: 'center',
          marginTop: '20px',
          color: '#6b7280'
        }}>
          Already have an account?{' '}
          <Link 
            to="/sign-in"
            style={{ color: '#3182ce', textDecoration: 'none', fontWeight: '500' }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

// Dashboard
function DashboardPage() {
  const { user } = useAuth();
  
  return (
    <div>
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '40px',
        borderRadius: '12px',
        textAlign: 'center',
        marginBottom: '30px'
      }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>
          Welcome, {user?.firstName || 'User'}! 🎉
        </h1>
        <p style={{ fontSize: '1.1rem', opacity: '0.9' }}>
          Your Marketing Machine account is ready to transform your meeting recordings
        </p>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '20px', 
        marginBottom: '30px'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #3182ce'
        }}>
          <h3 style={{ color: '#1e40af', marginBottom: '15px', fontSize: '1.2rem' }}>
            🔗 Setup Webhooks
          </h3>
          <p style={{ color: '#374151', marginBottom: '20px', lineHeight: '1.6' }}>
            Connect your meeting platforms for automatic content generation
          </p>
          <Link
            to="/webhooks"
            style={{
              backgroundColor: '#3182ce',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: '500'
            }}
          >
            Configure Webhooks
          </Link>
        </div>
        
        <div style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #10b981'
        }}>
          <h3 style={{ color: '#166534', marginBottom: '15px', fontSize: '1.2rem' }}>
            📝 Create Content
          </h3>
          <p style={{ color: '#374151', marginBottom: '20px', lineHeight: '1.6' }}>
            Transform your meeting recordings into LinkedIn posts
          </p>
          <Link
            to="/content"
            style={{
              backgroundColor: '#10b981',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: '500'
            }}
          >
            Start Creating
          </Link>
        </div>
      </div>
      
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ marginBottom: '20px', color: '#2d3748' }}>📊 Account Information</h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '20px' 
        }}>
          <div>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '4px' }}>Name</p>
            <p style={{ fontWeight: '500', color: '#374151' }}>
              {user?.fullName || 'Not provided'}
            </p>
          </div>
          <div>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '4px' }}>Email</p>
            <p style={{ fontWeight: '500', color: '#374151' }}>
              {user?.primaryEmailAddress?.emailAddress || 'Not provided'}
            </p>
          </div>
          <div>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '4px' }}>Member Since</p>
            <p style={{ fontWeight: '500', color: '#374151' }}>
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Recently'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple placeholder pages
function WebhooksPage() {
  return (
    <div>
      <h1 style={{ fontSize: '2rem', color: '#2d3748', marginBottom: '20px' }}>
        🔗 Webhook Configuration
      </h1>
      <div style={{ 
        backgroundColor: 'white', 
        padding: '40px', 
        borderRadius: '12px', 
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)' 
      }}>
        <p style={{ fontSize: '1.1rem', color: '#4a5568', marginBottom: '30px' }}>
          Connect your meeting platforms to automatically process recordings and generate LinkedIn content.
        </p>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '20px' 
        }}>
          <div style={{ 
            border: '1px solid #d1d5db', 
            padding: '30px', 
            borderRadius: '8px', 
            textAlign: 'center' 
          }}>
            <h4 style={{ marginBottom: '15px' }}>🎥 Zoom</h4>
            <p style={{ color: '#6b7280', marginBottom: '20px' }}>Connect your Zoom account</p>
            <button style={{
              backgroundColor: '#3182ce',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}>
              Configure Zoom
            </button>
          </div>
          <div style={{ 
            border: '1px solid #d1d5db', 
            padding: '30px', 
            borderRadius: '8px', 
            textAlign: 'center' 
          }}>
            <h4 style={{ marginBottom: '15px' }}>📹 Microsoft Teams</h4>
            <p style={{ color: '#6b7280', marginBottom: '20px' }}>Connect your Teams account</p>
            <button style={{
              backgroundColor: '#3182ce',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}>
              Configure Teams
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContentPage() {
  return (
    <div>
      <h1 style={{ fontSize: '2rem', color: '#2d3748', marginBottom: '20px' }}>
        📝 Content Creation
      </h1>
      <div style={{ 
        backgroundColor: 'white', 
        padding: '40px', 
        borderRadius: '12px', 
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)' 
      }}>
        <h3 style={{ marginBottom: '20px' }}>Transform Meeting Recordings</h3>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            fontWeight: '500' 
          }}>
            Meeting Transcript
          </label>
          <textarea 
            placeholder="Paste your meeting transcript here..."
            rows="8"
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '1rem'
            }}
          />
        </div>
        <button style={{
          backgroundColor: '#10b981',
          color: 'white',
          border: 'none',
          padding: '12px 24px',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: '500',
          marginRight: '15px'
        }}>
          Generate LinkedIn Post
        </button>
        <button style={{
          backgroundColor: '#6b7280',
          color: 'white',
          border: 'none',
          padding: '12px 24px',
          borderRadius: '6px',
          cursor: 'pointer'
        }}>
          Load Sample
        </button>
      </div>
    </div>
  );
}

// Protected Route wrapper
function ProtectedRoute({ children }) {
  return (
    <SignedIn>
      <Layout>{children}</Layout>
    </SignedIn>
  );
}

// Main App with Clerk integration
function ClerkApp() {
  return (
    <Routes>
      <Route path="/" element={<Layout><HomePage /></Layout>} />
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/sign-up" element={<SignUpPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/webhooks" element={<ProtectedRoute><WebhooksPage /></ProtectedRoute>} />
      <Route path="/content" element={<ProtectedRoute><ContentPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default ClerkApp;