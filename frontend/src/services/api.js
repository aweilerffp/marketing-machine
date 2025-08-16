import axios from 'axios'

// Create axios instance with default config
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    // Add timestamp to prevent caching
    if (config.method === 'get') {
      config.params = {
        ...config.params,
        _t: Date.now()
      }
    }

    // Add Clerk token if available (will be set by components using useAuth)
    // Token will be added by authenticated components

    // Log requests in development
    if (import.meta.env.DEV) {
      console.log(`🔵 ${config.method?.toUpperCase()} ${config.url}`, config.data)
    }

    return config
  },
  (error) => {
    console.error('Request error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // Log responses in development
    if (import.meta.env.DEV) {
      console.log(`🟢 ${response.status} ${response.config.url}`, response.data)
    }
    return response
  },
  (error) => {
    // Log errors in development
    if (import.meta.env.DEV) {
      console.error(`🔴 ${error.response?.status || 'Network'} ${error.config?.url}`, {
        message: error.response?.data?.error?.message || error.message,
        data: error.response?.data
      })
    }

    // Handle common errors
    if (error.response?.status === 429) {
      // Rate limiting
      const retryAfter = error.response.headers['retry-after']
      if (retryAfter) {
        error.retryAfter = parseInt(retryAfter) * 1000 // Convert to milliseconds
      }
    }

    return Promise.reject(error)
  }
)

// API methods
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
}

export const companyAPI = {
  get: () => api.get('/companies/current'),
  update: (data) => api.put('/companies/current', data),
  getProfile: () => api.get('/companies/profile'),
  updateProfile: (data) => api.put('/companies/profile', data),
}

export const contentAPI = {
  // Manual content submission
  submitManual: (data) => api.post('/content/manual', data),
  
  // Content processing
  getProcessingStatus: (id) => api.get(`/content/processing/${id}`),
  getBatches: () => api.get('/content/batches'),
  getBatch: (id) => api.get(`/content/batches/${id}`),
  
  // Generated content
  getHooks: (batchId) => api.get(`/content/hooks/${batchId}`),
  getPosts: (batchId) => api.get(`/content/posts/${batchId}`),
  
  // File upload
  uploadFile: (file, onUploadProgress) => {
    const formData = new FormData()
    formData.append('file', file)
    
    return api.post('/content/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          )
          onUploadProgress(percentCompleted)
        }
      },
    })
  },
}

export const aiAPI = {
  // Hook generation
  generateHooks: (contentId) => api.post(`/ai/hooks/generate`, { contentId }),
  
  // Post generation
  generatePosts: (hookIds) => api.post(`/ai/posts/generate`, { hookIds }),
  
  // Image generation
  generateImages: (postId, options = {}) => api.post(`/ai/images/generate`, { postId, ...options }),
  
  // Get AI service status
  getStatus: () => api.get('/ai/status'),
  
  // Cost tracking
  getCosts: (period) => api.get(`/ai/costs?period=${period}`),
}

export const approvalAPI = {
  // Get posts pending approval
  getPendingPosts: () => api.get('/approval/pending'),
  
  // Approve/reject posts
  approvePost: (postId, feedback = null) => api.post(`/approval/${postId}/approve`, { feedback }),
  rejectPost: (postId, feedback) => api.post(`/approval/${postId}/reject`, { feedback }),
  
  // Edit and resubmit
  editPost: (postId, content) => api.put(`/approval/${postId}/edit`, { content }),
  
  // Bulk actions
  bulkApprove: (postIds) => api.post('/approval/bulk/approve', { postIds }),
  bulkReject: (postIds, feedback) => api.post('/approval/bulk/reject', { postIds, feedback }),
}

export const publishingAPI = {
  // Publishing queue
  getQueue: () => api.get('/publishing/queue'),
  schedulePost: (postId, scheduledFor) => api.post('/publishing/schedule', { postId, scheduledFor }),
  cancelScheduled: (postId) => api.delete(`/publishing/schedule/${postId}`),
  
  // Published posts
  getPublished: (params = {}) => api.get('/publishing/published', { params }),
  
  // LinkedIn integration
  getLinkedInStatus: () => api.get('/publishing/linkedin/status'),
  connectLinkedIn: () => api.get('/publishing/linkedin/auth'),
}

export const analyticsAPI = {
  // Dashboard stats
  getDashboard: () => api.get('/analytics/dashboard'),
  
  // Content performance
  getPostPerformance: (postId) => api.get(`/analytics/posts/${postId}`),
  getContentPerformance: (period = '30d') => api.get(`/analytics/content?period=${period}`),
  
  // System metrics
  getSystemMetrics: () => api.get('/analytics/system'),
  
  // Export data
  exportData: (type, period) => api.get(`/analytics/export/${type}?period=${period}`, {
    responseType: 'blob'
  }),
}

export const webhookAPI = {
  // Webhook configuration
  getConfigs: () => api.get('/webhooks/configs'),
  createConfig: (data) => api.post('/webhooks/configs', data),
  updateConfig: (id, data) => api.put(`/webhooks/configs/${id}`, data),
  deleteConfig: (id) => api.delete(`/webhooks/configs/${id}`),
  
  // Test webhook
  testWebhook: (configId) => api.post(`/webhooks/test/${configId}`),
  
  // Delivery history
  getDeliveries: (configId) => api.get(`/webhooks/deliveries/${configId}`),
}

// Health check (use root endpoint which has more detailed health info)
export const healthCheck = () => axios.get('http://localhost:3001/health')

// Create authenticated API instance with Clerk token
export const createAuthenticatedAPI = (getToken) => {
  const authAPI = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  // Add Clerk token to requests
  authAPI.interceptors.request.use(
    async (config) => {
      try {
        const token = await getToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
      } catch (error) {
        console.warn('Failed to get Clerk token:', error)
      }

      // Add timestamp to prevent caching
      if (config.method === 'get') {
        config.params = {
          ...config.params,
          _t: Date.now()
        }
      }

      // Log requests in development
      if (import.meta.env.DEV) {
        console.log(`🔵 ${config.method?.toUpperCase()} ${config.url}`, config.data)
      }

      return config
    },
    (error) => {
      console.error('Auth API Request error:', error)
      return Promise.reject(error)
    }
  )

  // Response interceptor
  authAPI.interceptors.response.use(
    (response) => {
      if (import.meta.env.DEV) {
        console.log(`🟢 ${response.status} ${response.config.url}`, response.data)
      }
      return response
    },
    (error) => {
      if (import.meta.env.DEV) {
        console.error(`🔴 ${error.response?.status || 'Network'} ${error.config?.url}`, {
          message: error.response?.data?.error?.message || error.message,
          data: error.response?.data
        })
      }
      return Promise.reject(error)
    }
  )

  return authAPI
}

export default api