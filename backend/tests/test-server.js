/**
 * Marketing Machine - Test Server
 * Lightweight server for testing approval routes
 */

const express = require('express');
const app = express();

// Mock database and queue before importing routes
jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn()
}));

jest.mock('../src/config/queue', () => ({
  publishingQueue: {
    add: jest.fn().mockResolvedValue({})
  },
  contentQueue: {
    add: jest.fn().mockResolvedValue({})
  }
}));

// Mock middleware
const mockAuth = (req, res, next) => {
  req.user = {
    id: 1,
    companyId: 1,
    userId: 1,
    name: 'Test User',
    role: 'admin'
  };
  next();
};

// Basic middleware
app.use(express.json());

// Import only the approval routes
const approvalRoutes = require('../src/routes/approval');
app.use('/api/approval', mockAuth, approvalRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handler
app.use((error, req, res, next) => {
  res.status(error.status || 500).json({
    error: error.message || 'Internal server error'
  });
});

module.exports = app;