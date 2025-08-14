/**
 * Marketing Machine - Companies Routes
 */

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'Companies endpoint' });
});

module.exports = router;