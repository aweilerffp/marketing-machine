import React from 'react'
import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">Marketing Machine</h1>
        <p className="text-gray-600 text-center mb-8">Transform your meeting recordings into engaging LinkedIn content</p>
        <Link 
          to="/login" 
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition duration-200 block text-center"
        >
          Get Started
        </Link>
      </div>
    </div>
  )
}