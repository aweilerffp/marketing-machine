/**
 * Simple App for debugging production issues
 */

import React from 'react';

function SimpleApp() {
  return (
    <div style={{
      padding: '40px',
      textAlign: 'center',
      fontFamily: 'system-ui, sans-serif',
      minHeight: '100vh',
      backgroundColor: '#f7fafc'
    }}>
      <h1 style={{ fontSize: '3rem', color: '#2d3748', marginBottom: '20px' }}>
        🚀 Marketing Machine
      </h1>
      <p style={{ fontSize: '1.2rem', color: '#666', marginBottom: '30px' }}>
        Transform your meeting recordings into engaging LinkedIn content
      </p>
      
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        maxWidth: '600px',
        margin: '0 auto',
        marginBottom: '30px'
      }}>
        <h2 style={{ marginTop: 0, color: '#2d3748' }}>System Status</h2>
        <div style={{ textAlign: 'left' }}>
          <p>✅ Frontend: Deployed and working</p>
          <p>✅ React: Loading successfully</p>
          <p>⏳ Authentication: Initializing...</p>
          <p>⏳ Backend API: Connecting...</p>
        </div>
      </div>

      <div style={{
        backgroundColor: '#e2e8f0',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h3 style={{ marginTop: 0 }}>Environment Info</h3>
        <p>Mode: {import.meta.env.MODE}</p>
        <p>Node ENV: {import.meta.env.NODE_ENV}</p>
        <p>Build Time: {new Date().toISOString()}</p>
      </div>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button
          onClick={() => window.location.href = '/dashboard'}
          style={{
            backgroundColor: '#3182ce',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Go to Dashboard
        </button>
        <button
          onClick={() => window.location.reload()}
          style={{
            backgroundColor: '#38a169',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}

export default SimpleApp;