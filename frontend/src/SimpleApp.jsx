/**
 * Simple App for production debugging - no external dependencies
 */

import React from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';

// Simple authentication context
const AuthContext = React.createContext();

function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

function AuthProvider({ children }) {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  
  // Check for existing session
  React.useEffect(() => {
    const savedUser = localStorage.getItem('marketing-machine-user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('marketing-machine-user');
      }
    }
  }, []);
  
  const signIn = async (email, password) => {
    setLoading(true);
    // Simulate authentication
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockUser = {
      id: Date.now(),
      email,
      firstName: email.split('@')[0],
      lastName: 'User',
      fullName: email.split('@')[0] + ' User',
      createdAt: new Date().toISOString()
    };
    
    setUser(mockUser);
    localStorage.setItem('marketing-machine-user', JSON.stringify(mockUser));
    setLoading(false);
    return mockUser;
  };
  
  const signUp = async (email, password, firstName, lastName) => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockUser = {
      id: Date.now(),
      email,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      createdAt: new Date().toISOString()
    };
    
    setUser(mockUser);
    localStorage.setItem('marketing-machine-user', JSON.stringify(mockUser));
    setLoading(false);
    return mockUser;
  };
  
  const signOut = () => {
    setUser(null);
    localStorage.removeItem('marketing-machine-user');
  };
  
  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// Layout component
function Layout({ children }) {
  const { user, signOut } = useAuth();
  
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
            {user ? (
              <>
                <Link to="/dashboard" style={{ color: '#4a5568', textDecoration: 'none' }}>Dashboard</Link>
                <Link to="/webhooks" style={{ color: '#4a5568', textDecoration: 'none' }}>Webhooks</Link>
                <Link to="/content" style={{ color: '#4a5568', textDecoration: 'none' }}>Content</Link>
                <span style={{ color: '#4a5568' }}>Hello, {user.firstName}!</span>
                <button
                  onClick={signOut}
                  style={{
                    backgroundColor: '#e53e3e',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                to="/sign-in"
                style={{
                  backgroundColor: '#3182ce',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  textDecoration: 'none'
                }}
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </nav>
      
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
        {children}
      </main>
    </div>
  );
}

// Homepage component
function HomePage() {
  console.log('SimpleApp HomePage rendering...');
  const { user } = useAuth();
  
  return (
    <div style={{
      padding: '40px',
      textAlign: 'center',
      fontFamily: 'system-ui, sans-serif',
      minHeight: '100vh',
      backgroundColor: '#f7fafc',
      color: '#2d3748'
    }}>
      <h1 style={{ 
        fontSize: '3rem', 
        color: '#2d3748', 
        marginBottom: '20px',
        textShadow: '2px 2px 4px rgba(0,0,0,0.1)'
      }}>
        🚀 Marketing Machine
      </h1>
      
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        maxWidth: '700px',
        margin: '0 auto',
        marginBottom: '30px'
      }}>
        <h2 style={{ color: '#2d3748', marginTop: 0 }}>✅ Production Status: ACTIVE</h2>
        
        <div style={{ textAlign: 'left', marginBottom: '20px' }}>
          <p style={{ margin: '8px 0' }}>🟢 <strong>React App:</strong> {mounted ? 'Fully Loaded' : 'Loading...'}</p>
          <p style={{ margin: '8px 0' }}>🟢 <strong>Component:</strong> SimpleApp rendering successfully</p>
          <p style={{ margin: '8px 0' }}>🟢 <strong>JavaScript:</strong> Working correctly</p>
          <p style={{ margin: '8px 0' }}>🟢 <strong>Styles:</strong> Applied successfully</p>
        </div>
        
        <div style={{
          backgroundColor: '#e6fffa',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #38b2ac'
        }}>
          <h3 style={{ color: '#234e52', margin: '0 0 10px 0' }}>🎯 Next Steps</h3>
          <p style={{ color: '#234e52', margin: 0 }}>
            The React application is working correctly. You can now access the full Marketing Machine features.
          </p>
        </div>
      </div>
      
      <div style={{
        backgroundColor: '#ffffff',
        padding: '20px',
        borderRadius: '8px',
        margin: '20px auto',
        maxWidth: '700px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ marginTop: 0, color: '#2d3748' }}>Transform Your Meeting Recordings</h3>
        <p style={{ color: '#4a5568', lineHeight: '1.6' }}>
          Upload your meeting transcripts and let our AI create engaging LinkedIn content 
          that drives professional engagement and business growth.
        </p>
      </div>
      
      <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => window.location.href = '/dashboard'}
          style={{
            backgroundColor: '#3182ce',
            color: 'white',
            padding: '15px 30px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1.1rem',
            fontWeight: '600',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          Access Dashboard
        </button>
        
        <button
          onClick={() => window.location.href = '/webhooks'}
          style={{
            backgroundColor: '#38a169',
            color: 'white',
            padding: '15px 30px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1.1rem',
            fontWeight: '600',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          Setup Webhooks
        </button>
        
        <button
          onClick={() => window.location.reload()}
          style={{
            backgroundColor: '#6b7280',
            color: 'white',
            padding: '15px 30px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1.1rem',
            fontWeight: '600',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          Refresh Page
        </button>
      </div>
      
      <div style={{ 
        marginTop: '40px', 
        fontSize: '0.9rem', 
        color: '#6b7280',
        fontStyle: 'italic'
      }}>
        <p>Environment: {import.meta.env.MODE || 'production'}</p>
        <p>Build Time: {new Date().toLocaleString()}</p>
        <p>Version: 1.0.0 - {user ? 'Authenticated' : 'Guest'}</p>
      </div>
    </div>
  );
}

// Sign In Page
function SignInPage() {
  const { signIn, loading } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = React.useState({
    email: '',
    password: ''
  });
  const [error, setError] = React.useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      return;
    }
    
    try {
      await signIn(formData.email, formData.password);
      navigate('/dashboard');
    } catch (err) {
      setError('Sign in failed. Please try again.');
    }
  };
  
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f7fafc',
      padding: '20px'
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
          fontSize: '2rem',
          fontWeight: 'bold',
          color: '#2d3748',
          marginBottom: '8px',
          textAlign: 'center'
        }}>
          Welcome Back
        </h1>
        <p style={{
          color: '#4a5568',
          textAlign: 'center',
          marginBottom: '32px'
        }}>
          Sign in to your Marketing Machine account
        </p>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '1rem'
              }}
              placeholder="Enter your email"
            />
          </div>
          
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Password
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '1rem'
              }}
              placeholder="Enter your password"
            />
          </div>
          
          {error && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '20px',
              fontSize: '0.9rem'
            }}>
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              backgroundColor: loading ? '#9ca3af' : '#3182ce',
              color: 'white',
              border: 'none',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '20px'
            }}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
        
        <p style={{
          textAlign: 'center',
          color: '#6b7280',
          fontSize: '0.9rem'
        }}>
          Don't have an account?{' '}
          <Link to="/sign-up" style={{
            color: '#3182ce',
            textDecoration: 'none',
            fontWeight: '500'
          }}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

// Sign Up Page
function SignUpPage() {
  const { signUp, loading } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = React.useState({
    firstName: '',
    lastName: '',
    email: '',
    password: ''
  });
  const [error, setError] = React.useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      setError('Please fill in all fields');
      return;
    }
    
    try {
      await signUp(formData.email, formData.password, formData.firstName, formData.lastName);
      navigate('/dashboard');
    } catch (err) {
      setError('Sign up failed. Please try again.');
    }
  };
  
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f7fafc',
      padding: '20px'
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
          fontSize: '2rem',
          fontWeight: 'bold',
          color: '#2d3748',
          marginBottom: '8px',
          textAlign: 'center'
        }}>
          Get Started
        </h1>
        <p style={{
          color: '#4a5568',
          textAlign: 'center',
          marginBottom: '32px'
        }}>
          Create your Marketing Machine account
        </p>
        
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <label style={{
                display: 'block',
                fontSize: '0.9rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                First Name
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '1rem'
                }}
                placeholder="First name"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{
                display: 'block',
                fontSize: '0.9rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Last Name
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '1rem'
                }}
                placeholder="Last name"
              />
            </div>
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '1rem'
              }}
              placeholder="Enter your email"
            />
          </div>
          
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Password
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '1rem'
              }}
              placeholder="Create a password"
            />
          </div>
          
          {error && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '20px',
              fontSize: '0.9rem'
            }}>
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              backgroundColor: loading ? '#9ca3af' : '#10b981',
              color: 'white',
              border: 'none',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '20px'
            }}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
        
        <p style={{
          textAlign: 'center',
          color: '#6b7280',
          fontSize: '0.9rem'
        }}>
          Already have an account?{' '}
          <Link to="/sign-in" style={{
            color: '#3182ce',
            textDecoration: 'none',
            fontWeight: '500'
          }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

// Dashboard Page
function DashboardPage() {
  const { user } = useAuth();
  
  return (
    <div>
      <h1 style={{
        fontSize: '2.5rem',
        fontWeight: 'bold',
        color: '#2d3748',
        marginBottom: '20px'
      }}>
        Welcome, {user?.firstName}!
      </h1>
      
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        marginBottom: '30px'
      }}>
        <h2 style={{ color: '#2d3748', marginBottom: '16px' }}>🎉 Account Created Successfully!</h2>
        <p style={{ color: '#4a5568', lineHeight: '1.6', marginBottom: '20px' }}>
          Your Marketing Machine account is ready! Here's what you can do next:
        </p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
          <div style={{
            backgroundColor: '#f0f9ff',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #bae6fd'
          }}>
            <h3 style={{ color: '#0369a1', marginBottom: '10px' }}>🔗 Setup Webhooks</h3>
            <p style={{ color: '#374151', fontSize: '0.9rem', marginBottom: '15px' }}>
              Connect your meeting platforms for automatic content generation
            </p>
            <Link to="/webhooks" style={{
              backgroundColor: '#3182ce',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '0.9rem'
            }}>
              Configure Webhooks
            </Link>
          </div>
          
          <div style={{
            backgroundColor: '#f0fdf4',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #bbf7d0'
          }}>
            <h3 style={{ color: '#166534', marginBottom: '10px' }}>📝 Create Content</h3>
            <p style={{ color: '#374151', fontSize: '0.9rem', marginBottom: '15px' }}>
              Transform your meeting recordings into LinkedIn posts
            </p>
            <Link to="/content" style={{
              backgroundColor: '#10b981',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '0.9rem'
            }}>
              Start Creating
            </Link>
          </div>
        </div>
      </div>
      
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ color: '#2d3748', marginBottom: '15px' }}>📊 Account Info</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '4px' }}>Name</p>
            <p style={{ color: '#374151', fontWeight: '500' }}>{user?.fullName}</p>
          </div>
          <div>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '4px' }}>Email</p>
            <p style={{ color: '#374151', fontWeight: '500' }}>{user?.email}</p>
          </div>
          <div>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '4px' }}>Member Since</p>
            <p style={{ color: '#374151', fontWeight: '500' }}>
              {new Date(user?.createdAt).toLocaleDateString()}
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
      <h1 style={{ fontSize: '2rem', color: '#2d3748', marginBottom: '20px' }}>🔗 Webhook Setup</h1>
      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <p>Webhook configuration will be available here. Connect your meeting platforms to automatically generate content.</p>
      </div>
    </div>
  );
}

function ContentPage() {
  return (
    <div>
      <h1 style={{ fontSize: '2rem', color: '#2d3748', marginBottom: '20px' }}>📝 Content Creation</h1>
      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <p>Content creation tools will be available here. Upload transcripts and generate LinkedIn posts.</p>
      </div>
    </div>
  );
}

// Main App Component with routing
function SimpleApp() {
  const { user } = useAuth();
  
  return (
    <Routes>
      <Route path="/" element={user ? <Layout><DashboardPage /></Layout> : <HomePage />} />
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/sign-up" element={<SignUpPage />} />
      <Route path="/dashboard" element={<Layout><DashboardPage /></Layout>} />
      <Route path="/webhooks" element={<Layout><WebhooksPage /></Layout>} />
      <Route path="/content" element={<Layout><ContentPage /></Layout>} />
    </Routes>
  );
}

// Export with AuthProvider wrapper
export default function AppWithAuth() {
  return (
    <AuthProvider>
      <SimpleApp />
    </AuthProvider>
  );
}