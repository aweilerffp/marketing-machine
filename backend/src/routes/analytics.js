/**
 * Marketing Machine - Analytics Routes
 */

const express = require('express');
const router = express.Router();

router.get('/stats', (req, res) => {
  res.json({ message: 'Analytics endpoint' });
});

module.exports = router;