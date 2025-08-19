/**
 * Error Boundary Component to catch React errors
 */

import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React Error Boundary caught an error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          maxWidth: '600px',
          margin: '0 auto',
          marginTop: '100px'
        }}>
          <h1 style={{ color: '#e53e3e', fontSize: '2rem', marginBottom: '20px' }}>
            🚨 Something went wrong
          </h1>
          <p style={{ fontSize: '1.1rem', marginBottom: '20px', color: '#666' }}>
            The Marketing Machine encountered an unexpected error.
          </p>
          
          <div style={{
            backgroundColor: '#f7fafc',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
            textAlign: 'left'
          }}>
            <h3 style={{ marginTop: 0 }}>Error Details:</h3>
            <pre style={{
              fontSize: '14px',
              color: '#e53e3e',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {this.state.error && this.state.error.toString()}
            </pre>
            
            <details style={{ marginTop: '10px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                Stack Trace
              </summary>
              <pre style={{
                fontSize: '12px',
                color: '#666',
                marginTop: '10px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          </div>

          <button
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: '#3182ce',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '6px',
              fontSize: '1rem',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            Reload Page
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            style={{
              backgroundColor: '#38a169',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '6px',
              fontSize: '1rem',
              cursor: 'pointer'
            }}
          >
            Go Home
          </button>

          <div style={{ marginTop: '30px', fontSize: '14px', color: '#666' }}>
            <p>If this problem persists, please contact support.</p>
            <p>Error ID: {Date.now()}</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;