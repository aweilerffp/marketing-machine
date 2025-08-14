import React from 'react'
import ReactDOM from 'react-dom/client'

console.log('Main.jsx loaded successfully')

const root = document.getElementById('root')
console.log('Root element found:', !!root)

if (!root) {
  document.body.innerHTML = '<div style="padding: 20px; text-align: center;"><h1>Error: No root element found</h1></div>'
} else {
  try {
    ReactDOM.createRoot(root).render(
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#f9fafb', 
        padding: '20px',
        fontFamily: 'Inter, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <h1 style={{ 
          fontSize: '3rem', 
          fontWeight: 'bold', 
          color: '#111827', 
          marginBottom: '1rem',
          textAlign: 'center'
        }}>
          Marketing Machine
        </h1>
        <p style={{ 
          fontSize: '1.25rem', 
          color: '#6b7280', 
          marginBottom: '2rem',
          textAlign: 'center'
        }}>
          🎉 Success! The app is now working on Vercel
        </p>
        <div style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          maxWidth: '600px',
          textAlign: 'center'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>
            Next Steps
          </h2>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
            Now that we've confirmed the deployment works, we can add back the authentication and full functionality.
          </p>
          <div style={{ 
            backgroundColor: '#f3f4f6', 
            padding: '1rem', 
            borderRadius: '0.25rem',
            fontFamily: 'monospace',
            fontSize: '0.875rem'
          }}>
            Environment: {import.meta.env.MODE}<br/>
            Build: {new Date().toISOString()}
          </div>
        </div>
      </div>
    )
    console.log('App rendered successfully')
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