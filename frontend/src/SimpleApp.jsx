/**
 * Simple App for production debugging - no external dependencies
 */

import React from 'react';

function SimpleApp() {
  console.log('SimpleApp component rendering...');
  
  const [mounted, setMounted] = React.useState(false);
  
  React.useEffect(() => {
    console.log('SimpleApp mounted successfully');
    setMounted(true);
  }, []);
  
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
        <p>Version: 1.0.0</p>
      </div>
    </div>
  );
}

export default SimpleApp;