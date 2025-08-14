import { useState, useEffect, createContext, useContext } from 'react'
import { useQuery, useQueryClient } from 'react-query'
import api from '@/services/api'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('auth_token'))
  const queryClient = useQueryClient()

  // Get user data if token exists
  const { data: user, isLoading, error } = useQuery(
    ['user'],
    async () => {
      if (!token) return null
      const response = await api.get('/auth/me')
      return response.data
    },
    {
      enabled: !!token,
      retry: false,
      onError: (error) => {
        if (error.response?.status === 401) {
          // Token is invalid, clear it
          logout()
        }
      }
    }
  )

  // Set up axios interceptor for auth token
  useEffect(() => {
    const interceptor = api.interceptors.request.use(
      (config) => {
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor for handling 401 errors
    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 && token) {
          logout()
        }
        return Promise.reject(error)
      }
    )

    return () => {
      api.interceptors.request.eject(interceptor)
      api.interceptors.response.eject(responseInterceptor)
    }
  }, [token])

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password })
      const { token: authToken, user: userData } = response.data
      
      setToken(authToken)
      localStorage.setItem('auth_token', authToken)
      
      // Update the user cache
      queryClient.setQueryData(['user'], userData)
      
      return { success: true, user: userData }
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Login failed'
      return { success: false, error: message }
    }
  }

  const register = async (userData) => {
    try {
      const response = await api.post('/auth/register', userData)
      const { token: authToken, user: newUser } = response.data
      
      setToken(authToken)
      localStorage.setItem('auth_token', authToken)
      
      // Update the user cache
      queryClient.setQueryData(['user'], newUser)
      
      return { success: true, user: newUser }
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Registration failed'
      return { success: false, error: message }
    }
  }

  const logout = () => {
    setToken(null)
    localStorage.removeItem('auth_token')
    queryClient.clear() // Clear all cached data
    
    // Optional: Call logout endpoint to invalidate token on server
    if (token) {
      api.post('/auth/logout').catch(() => {
        // Ignore errors during logout
      })
    }
  }

  const updateProfile = async (profileData) => {
    try {
      const response = await api.put('/auth/profile', profileData)
      const updatedUser = response.data
      
      // Update the user cache
      queryClient.setQueryData(['user'], updatedUser)
      
      return { success: true, user: updatedUser }
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Profile update failed'
      return { success: false, error: message }
    }
  }

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    login,
    register,
    logout,
    updateProfile,
    error
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}