const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: errors.array().map(err => err.msg),
    });
  }
  next();
};

const registerValidation = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  handleValidationErrors,
];

const loginValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors,
];

const postValidation = [
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),
  body('description')
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  body('category')
    .isIn(['feature', 'bug', 'improvement'])
    .withMessage('Category must be feature, bug, or improvement'),
  handleValidationErrors,
];

const statusValidation = [
  body('status')
    .isIn(['open', 'planned', 'in-progress', 'shipped'])
    .withMessage('Status must be open, planned, in-progress, or shipped'),
  body('adminReply')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Admin reply must be 500 characters or less'),
  handleValidationErrors,
];

module.exports = {
  registerValidation,
  loginValidation,
  postValidation,
  statusValidation,
};
