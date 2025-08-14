import React from 'react'
import { Routes, Route } from 'react-router-dom'

// Pages
import HomePage from '@/pages/HomePage'

function App() {
  console.log('App component loaded')
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center text-gray-900 mb-8">
          Marketing Machine
        </h1>
        <div className="text-center">
          <p className="text-lg text-gray-600 mb-4">
            Deployment test - if you see this, the app is working!
          </p>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="*" element={<div>Page not found</div>} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

export default App