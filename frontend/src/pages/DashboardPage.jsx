import React, { useState, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { healthCheck, createAuthenticatedAPI } from '../services/api'

export default function DashboardPage() {
  const { getToken, isLoaded, userId } = useAuth()
  const [healthData, setHealthData] = useState(null)
  const [backendData, setBackendData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)

        // Test basic health check (no auth required)
        console.log('🔍 Testing backend health check...')
        const health = await healthCheck()
        setHealthData(health.data)
        console.log('✅ Health check successful:', health.data)

        // Test authenticated endpoint if user is logged in
        if (isLoaded && userId && getToken) {
          console.log('🔍 Testing authenticated endpoint...')
          const authAPI = createAuthenticatedAPI(getToken)
          
          try {
            // Try to get company info
            const companyResponse = await authAPI.get('/companies/current')
            setBackendData({ 
              type: 'company', 
              data: companyResponse.data,
              message: 'Successfully connected to backend with authentication!'
            })
            console.log('✅ Authenticated request successful:', companyResponse.data)
          } catch (authError) {
            console.log('⚠️ Authenticated request failed (expected for now):', authError.response?.data || authError.message)
            setBackendData({ 
              type: 'auth_error', 
              error: authError.response?.data || { message: authError.message },
              message: 'Backend connection works, but authentication needs to be configured'
            })
          }
        }

      } catch (err) {
        console.error('❌ Dashboard data fetch failed:', err)
        setError(err.response?.data || { message: err.message })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [isLoaded, userId, getToken])

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Dashboard</h3>
            <p className="text-gray-600">Connecting to backend...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Marketing Machine Dashboard</h1>
        <p className="text-gray-600">Backend integration test and system status</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Backend Health Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <span className={`inline-block w-3 h-3 rounded-full mr-2 ${healthData ? 'bg-green-500' : 'bg-red-500'}`}></span>
            Backend Health
          </h3>
          
          {healthData ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Status:</span>
                  <span className="ml-2 text-green-600">{healthData.status}</span>
                </div>
                <div>
                  <span className="font-medium">Environment:</span>
                  <span className="ml-2">{healthData.environment}</span>
                </div>
                <div>
                  <span className="font-medium">Version:</span>
                  <span className="ml-2">{healthData.version}</span>
                </div>
                <div>
                  <span className="font-medium">Timestamp:</span>
                  <span className="ml-2">{new Date(healthData.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
              
              <div className="mt-4">
                <h4 className="font-medium text-gray-900 mb-2">Services:</h4>
                <div className="grid grid-cols-1 gap-1 text-sm">
                  {Object.entries(healthData.services || {}).map(([service, status]) => (
                    <div key={service} className="flex justify-between">
                      <span className="capitalize">{service}:</span>
                      <span className={`font-medium ${status === 'connected' || status === 'running' ? 'text-green-600' : 'text-red-600'}`}>
                        {status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-red-600">
              <p>❌ Backend connection failed</p>
              {error && <p className="text-sm mt-1">{error.message}</p>}
            </div>
          )}
        </div>

        {/* Authentication Test */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <span className={`inline-block w-3 h-3 rounded-full mr-2 ${backendData?.type === 'company' ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
            Authentication Test
          </h3>
          
          {!userId ? (
            <div className="text-gray-600">
              <p>🔐 Please sign in to test authenticated endpoints</p>
            </div>
          ) : backendData ? (
            <div className="space-y-2">
              <p className="text-sm">{backendData.message}</p>
              
              {backendData.type === 'company' && (
                <div className="mt-3 p-3 bg-green-50 rounded">
                  <h4 className="font-medium text-green-800">Company Data:</h4>
                  <pre className="text-xs mt-1 text-green-700 overflow-auto">
                    {JSON.stringify(backendData.data, null, 2)}
                  </pre>
                </div>
              )}
              
              {backendData.type === 'auth_error' && (
                <div className="mt-3 p-3 bg-yellow-50 rounded">
                  <h4 className="font-medium text-yellow-800">Authentication Details:</h4>
                  <p className="text-xs mt-1 text-yellow-700">
                    Status: {backendData.error?.error?.code || 'Unknown error'}
                  </p>
                  <p className="text-xs text-yellow-700">
                    Message: {backendData.error?.error?.message || backendData.error?.message}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-600">
              <p>⏳ Testing authentication...</p>
            </div>
          )}
        </div>

        {/* User Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">User Information</h3>
          
          {isLoaded ? (
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">User ID:</span>
                <span className="ml-2">{userId || 'Not signed in'}</span>
              </div>
              <div>
                <span className="font-medium">Auth Status:</span>
                <span className="ml-2">{userId ? 'Authenticated' : 'Not authenticated'}</span>
              </div>
              <div>
                <span className="font-medium">Token Available:</span>
                <span className="ml-2">{getToken ? 'Yes' : 'No'}</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-600">Loading user information...</p>
          )}
        </div>

        {/* Next Steps */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Integration Progress</h3>
          
          <div className="space-y-3 text-sm">
            <div className="flex items-center">
              <span className="w-4 h-4 bg-green-500 rounded-full mr-3 flex items-center justify-center">
                <span className="text-white text-xs">✓</span>
              </span>
              <span>Frontend to Backend connection</span>
            </div>
            
            <div className="flex items-center">
              <span className="w-4 h-4 bg-green-500 rounded-full mr-3 flex items-center justify-center">
                <span className="text-white text-xs">✓</span>
              </span>
              <span>Database connectivity</span>
            </div>
            
            <div className="flex items-center">
              <span className="w-4 h-4 bg-yellow-500 rounded-full mr-3 flex items-center justify-center">
                <span className="text-white text-xs">⧗</span>
              </span>
              <span>Clerk authentication integration</span>
            </div>
            
            <div className="flex items-center">
              <span className="w-4 h-4 bg-gray-300 rounded-full mr-3 flex items-center justify-center">
                <span className="text-white text-xs">○</span>
              </span>
              <span>Real data operations</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}