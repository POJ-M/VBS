const errorHandler = (err, req, res, next) => {
  // FIX: Always log to server console with full details for debugging
  // but never send stack traces or internal details to the client
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', err);
  } else {
    // In production, log structured error without full stack to avoid log flooding
    console.error(JSON.stringify({
      message: err.message,
      path: req.path,
      method: req.method,
      code: err.code,
      name: err.name,
      timestamp: new Date().toISOString(),
    }));
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    return res.status(404).json({ success: false, message: 'Resource not found' });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue?.[field];
    const message = `${field.charAt(0).toUpperCase() + field.slice(1)} '${value}' already exists`;
    return res.status(400).json({ success: false, message });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: messages.join(', ') });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token has expired' });
  }

  // CORS errors
  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({ success: false, message: err.message });
  }

  // Mongoose connection errors — don't expose DB details
  if (err.name === 'MongoNetworkError' || err.name === 'MongooseServerSelectionError') {
    return res.status(503).json({ success: false, message: 'Service temporarily unavailable' });
  }

  // FIX: In production, never expose internal error messages
  const statusCode = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'An internal server error occurred'
      : err.message || 'Server Error';

  res.status(statusCode).json({ success: false, message });
};

const notFound = (req, res, next) => {
  const silentPaths = [
    '/favicon.ico', '/robots.txt', '/sitemap.xml',
    '/apple-touch-icon.png', '/apple-touch-icon-precomposed.png',
    '/manifest.json', '/.well-known/appspecific/com.chrome.devtools.json',
  ];
  if (silentPaths.includes(req.path)) {
    return res.status(404).end();
  }
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

module.exports = { errorHandler, notFound };
