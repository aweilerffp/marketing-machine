/**
 * Marketing Machine - Publishing Routes
 */

const express = require('express');
const router = express.Router();

router.post('/schedule', (req, res) => {
  res.json({ message: 'Publishing endpoint' });
});

module.exports = router;