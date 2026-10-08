const errorHandler = (error, req, res, next) => {
  console.error('Error:', error);

  let statusCode = 500;
  let message = 'Server Error';
  let errors = [];

  // Mongoose validation error
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    errors = Object.values(error.errors).map(err => err.message);
  }

  // Mongoose duplicate key error (11000)
  if (error.code === 11000) {
    statusCode = 400;
    message = 'Duplicate field value entered';
    const field = Object.keys(error.keyPattern)[0];
    errors = [`${field} already exists`];
  }

  // Mongoose cast error
  if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  }

  res.status(statusCode).json({
    success: false,
    message: error.message || message,
    ...(errors.length > 0 && { errors }),
  });
};

module.exports = errorHandler;
