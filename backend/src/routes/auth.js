/**
 * Marketing Machine - Auth Routes
 */

const express = require('express');
const router = express.Router();

// Placeholder auth routes
router.post('/login', (req, res) => {
  res.json({ message: 'Auth endpoint' });
});

router.post('/register', (req, res) => {
  res.json({ message: 'Register endpoint' });
});

module.exports = router;