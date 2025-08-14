import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth, SignedIn, SignedOut } from '@clerk/clerk-react'

// Components
import Layout from '@/components/Layout'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

// Pages
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import ContentInputPage from '@/pages/ContentInputPage'
import ApprovalPage from '@/pages/ApprovalPage'
import ApprovalDashboard from '@/pages/ApprovalDashboard'
import PublishingDashboard from '@/pages/PublishingDashboard'
import AnalyticsPage from '@/pages/AnalyticsPage'
import SettingsPage from '@/pages/SettingsPage'
import NotFoundPage from '@/pages/NotFoundPage'

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const { isLoaded } = useAuth()

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <SignedIn>
      {children}
    </SignedIn>
  )
}

// Public Route wrapper (redirect if authenticated)
function PublicRoute({ children }) {
  const { isLoaded } = useAuth()

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <>
      <SignedOut>
        {children}
      </SignedOut>
      <SignedIn>
        <Navigate to="/dashboard" replace />
      </SignedIn>
    </>
  )
}

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        {/* Public Routes */}
        <Route 
          path="/" 
          element={
            <PublicRoute>
              <HomePage />
            </PublicRoute>
          } 
        />
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } 
        />

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
                <ContentInputPage />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/approval" 
          element={
            <ProtectedRoute>
              <Layout>
                <ApprovalDashboard />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/publishing" 
          element={
            <ProtectedRoute>
              <Layout>
                <PublishingDashboard />
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
          path="/settings" 
          element={
            <ProtectedRoute>
              <Layout>
                <SettingsPage />
              </Layout>
            </ProtectedRoute>
          } 
        />

        {/* 404 Route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  )
}

export default App