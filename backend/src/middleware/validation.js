/**
 * Marketing Machine - Validation Middleware
 */

const validateRequest = (schema) => {
  return (req, res, next) => {
    next(); // Pass-through validation for now
  };
};

module.exports = {
  validateRequest
};